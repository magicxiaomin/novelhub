import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { PRISMA } from '../auth/auth.constants';

import { FbCapiService } from './fb-capi.service';

type StoredFbEvent = {
  eventName: string;
  eventId: string;
  userId?: string;
  payload: unknown;
  responseCode: number | null;
  responseBody: string | null;
};

const makePrismaStub = () => {
  const events = new Map<string, StoredFbEvent>();
  return {
    events,
    prisma: {
      fbEvent: {
        findUnique: jest.fn(async ({ where }: { where: { eventId: string } }) =>
          events.has(where.eventId) ? { id: `fb-${where.eventId}` } : null,
        ),
        create: jest.fn(async ({ data }: { data: StoredFbEvent }) => {
          if (events.has(data.eventId)) {
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          events.set(data.eventId, data);
          return data;
        }),
      },
    },
  };
};

describe('FbCapiService', () => {
  const ORIGINAL_ENV = { ...process.env };
  let service: FbCapiService;
  let prismaStub: ReturnType<typeof makePrismaStub>;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-07T12:00:00.000Z'));
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_FB_PIXEL_ID: 'pixel-123',
      FB_CAPI_ACCESS_TOKEN: 'token-123',
      FB_TEST_EVENT_CODE: undefined,
      NODE_ENV: 'test',
    };
    prismaStub = makePrismaStub();
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async () => new Response('{"events_received":1}', { status: 200 }),
    );
    global.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [FbCapiService, { provide: PRISMA, useValue: prismaStub.prisma }],
    }).compile();

    service = module.get(FbCapiService);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('short-circuits when the access token is unset', async () => {
    delete process.env.FB_CAPI_ACCESS_TOKEN;

    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaStub.prisma.fbEvent.create).not.toHaveBeenCalled();
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
    expect(prismaStub.prisma.fbEvent.create).not.toHaveBeenCalled();
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

  it('includes test_event_code in non-production when configured', async () => {
    process.env.FB_TEST_EVENT_CODE = 'TEST123';

    await service.sendEvent('Purchase', 'event-1', { email: 'a@example.com' });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      test_event_code?: string;
    };
    expect(body.test_event_code).toBe('TEST123');
  });

  it('excludes test_event_code in production', async () => {
    process.env.FB_TEST_EVENT_CODE = 'TEST123';
    process.env.NODE_ENV = 'production';

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
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
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
});
