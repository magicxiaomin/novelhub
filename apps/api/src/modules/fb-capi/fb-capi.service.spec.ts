import { createHash } from 'node:crypto';

import { FbCapiService, type FbCapiServiceDeps } from './fb-capi.service';
import { buildFbCapiRequestFromHeaders } from './request';

type StoredFbEvent = {
  eventName: string;
  eventId: string;
  userId?: string | null;
  payload: unknown;
  responseCode: number | null;
  responseBody: string | null;
  sentAt?: Date;
};

const makePrismaStub = () => {
  const events = new Map<string, StoredFbEvent>();
  return {
    events,
    prisma: {
      fbEvent: {
        create: jest.fn(async ({ data }: { data: StoredFbEvent }) => {
          if (events.has(data.eventId)) {
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          events.set(data.eventId, data);
          return data;
        }),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { eventId: string };
            data: Partial<Pick<StoredFbEvent, 'responseCode' | 'responseBody' | 'sentAt'>>;
          }) => {
            const existing = events.get(where.eventId);
            if (!existing) throw new Error('Missing FbEvent');
            const next = { ...existing, ...data };
            events.set(where.eventId, next);
            return next;
          },
        ),
      },
    },
  };
};

describe('FbCapiService', () => {
  let service: FbCapiService;
  let prismaStub: ReturnType<typeof makePrismaStub>;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  const buildService = (
    overrides: Partial<{
      pixelId: string | undefined;
      accessToken: string | undefined;
      testEventCode: string | undefined;
      isProduction: boolean;
    }> = {},
  ): FbCapiService => {
    const deps = {
      prisma: prismaStub.prisma,
      pixelId: 'pixel-123',
      accessToken: 'token-123',
      testEventCode: undefined,
      isProduction: false,
      ...overrides,
    } as unknown as FbCapiServiceDeps;
    return new FbCapiService(deps);
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-07T12:00:00.000Z'));
    prismaStub = makePrismaStub();
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async () => new Response('{"events_received":1}', { status: 200 }),
    );
    global.fetch = fetchMock;

    service = buildService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('short-circuits when the access token is unset', async () => {
    service = buildService({ accessToken: undefined });

    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaStub.prisma.fbEvent.create).not.toHaveBeenCalled();
    expect(prismaStub.prisma.fbEvent.update).not.toHaveBeenCalled();
  });

  it('short-circuits when an FbEvent with the same event_id already exists', async () => {
    prismaStub.events.set('event-1', {
      eventName: 'Purchase',
      eventId: 'event-1',
      payload: {},
      responseCode: 200,
      responseBody: '{}',
    });

    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaStub.prisma.fbEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaStub.prisma.fbEvent.update).not.toHaveBeenCalled();
  });

  it('hashes email as sha256 hex of trimmed lowercase before sending', async () => {
    await service.sendEvent('CompleteRegistration', 'event-1', {
      email: '  USER@Example.COM ',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      data: Array<{ user_data: { em: string[] } }>;
    };
    expect(body.data[0]?.user_data.em[0]).toBe(
      createHash('sha256').update('user@example.com').digest('hex'),
    );
    expect(JSON.stringify(body)).not.toContain('USER@Example.COM');
  });

  it('sends the access token in the JSON body, not the Graph API URL', async () => {
    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://graph.facebook.com/v18.0/pixel-123/events');
    expect(String(url)).not.toContain('access_token');
    const body = JSON.parse(String(init?.body)) as { access_token?: string };
    expect(body.access_token).toBe('token-123');
  });

  it('does not persist the access token in the FbEvent payload', async () => {
    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    expect(JSON.stringify(prismaStub.events.get('event-1')?.payload)).not.toContain('token-123');
    expect(
      (prismaStub.events.get('event-1')?.payload as { access_token?: string }).access_token,
    ).toBeUndefined();
  });

  it('caps stored responseBody at 4 KB', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x'.repeat(5000), { status: 200 }));

    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    expect(prismaStub.events.get('event-1')?.responseBody).toHaveLength(4096);
  });

  it('includes test_event_code in non-production when configured', async () => {
    service = buildService({ testEventCode: 'TEST123' });

    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      test_event_code?: string;
    };
    expect(body.test_event_code).toBe('TEST123');
  });

  it('excludes test_event_code in production', async () => {
    service = buildService({ testEventCode: 'TEST123', isProduction: true });

    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      test_event_code?: string;
    };
    expect(body.test_event_code).toBeUndefined();
  });

  it('writes an FbEvent row with the response code on success', async () => {
    await service.sendEvent(
      'Purchase',
      'event-1',
      { email: 'a@example.com', fbp: 'fbp', fbc: 'fbc' },
      { currency: 'USD', value: 9.99, contentIds: ['coins'], contentType: 'product' },
      'user-1',
    );

    expect(prismaStub.events.get('event-1')).toMatchObject({
      eventName: 'Purchase',
      eventId: 'event-1',
      userId: 'user-1',
      responseCode: 200,
      responseBody: '{"events_received":1}',
      sentAt: new Date('2026-05-07T12:00:00.000Z'),
    });
  });

  it('uses the supplied event id identically in the Graph payload and stored FbEvent row', async () => {
    await service.sendEvent(
      'Purchase',
      'cs_test_contract_123',
      { email: 'buyer@example.com' },
      { currency: 'USD', value: 19.99, contentIds: ['subscription'], contentType: 'product' },
      'user-1',
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      data: Array<{ event_id?: string; event_name?: string; custom_data?: { value?: number } }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      event_id: 'cs_test_contract_123',
      event_name: 'Purchase',
      custom_data: { value: 19.99 },
    });
    expect(prismaStub.events.get('cs_test_contract_123')).toMatchObject({
      eventId: 'cs_test_contract_123',
      eventName: 'Purchase',
      userId: 'user-1',
    });
  });

  it('writes an FbEvent row with the response code on Graph API 4xx without throwing', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad request', { status: 400 }));

    await expect(
      service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' }),
    ).resolves.toBeUndefined();

    expect(prismaStub.events.get('event-1')).toMatchObject({
      responseCode: 400,
      responseBody: 'bad request',
    });
  });

  it('does not throw on network error and logs it', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(
      service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' }),
    ).resolves.toBeUndefined();

    expect(prismaStub.events.get('event-1')).toMatchObject({
      responseCode: null,
      responseBody: null,
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('extracts _fbp and _fbc from the Nest Express request cookie shape', () => {
    const req = {
      cookies: {
        _fbp: 'fb.1.1778198400000.111',
        _fbc: 'fb.1.1778198400000.click',
      },
      ip: '203.0.113.10',
      headers: {
        'user-agent': 'Mozilla/5.0 Nest',
      },
    };

    expect(service.extractFbUserData(req, 'reader@example.com')).toEqual({
      email: 'reader@example.com',
      fbp: 'fb.1.1778198400000.111',
      fbc: 'fb.1.1778198400000.click',
      clientIpAddress: '203.0.113.10',
      clientUserAgent: 'Mozilla/5.0 Nest',
    });
  });

  it('extracts _fbp and _fbc from the Worker Hono cookie header shape', () => {
    const req = buildFbCapiRequestFromHeaders({
      cookieHeader:
        'consent=%7B%22analytics%22%3Atrue%2C%22marketing%22%3Atrue%7D; _fbp=fb.1.1778198400000.222; _fbc=fb.1.1778198400000.worker',
      ip: '198.51.100.20',
      userAgent: 'Mozilla/5.0 Worker',
    });

    expect(service.shouldSendForRequest(req)).toBe(true);
    expect(service.extractFbUserData(req)).toEqual({
      email: undefined,
      fbp: 'fb.1.1778198400000.222',
      fbc: 'fb.1.1778198400000.worker',
      clientIpAddress: '198.51.100.20',
      clientUserAgent: 'Mozilla/5.0 Worker',
    });
  });
});
