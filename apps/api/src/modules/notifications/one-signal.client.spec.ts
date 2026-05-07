import { OneSignalClient } from './one-signal.client';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ORIGINAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

const buildOkResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  }) as unknown as Response;

const makeTimeoutError = (): Error => {
  const err = new Error('The operation was aborted due to timeout');
  err.name = 'TimeoutError';
  return err;
};

describe('OneSignalClient', () => {
  beforeEach(() => {
    process.env.ONESIGNAL_REST_API_KEY = 'fake-key';
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID = 'fake-app-id';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.ONESIGNAL_REST_API_KEY = ORIGINAL_API_KEY;
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID = ORIGINAL_APP_ID;
    jest.restoreAllMocks();
  });

  it('sendNotification: passes an AbortSignal so a hung request is bounded', async () => {
    const fetchMock = jest.fn().mockResolvedValue(buildOkResponse({ id: 'push-1' }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const client = new OneSignalClient();

    await client.sendNotification({ title: 't', body: 'b', segments: ['All'] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit & { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('sendNotification: returns sent=false when fetch aborts on timeout', async () => {
    global.fetch = jest.fn().mockRejectedValue(makeTimeoutError()) as unknown as typeof fetch;
    const client = new OneSignalClient();

    await expect(
      client.sendNotification({ title: 't', body: 'b', segments: ['All'] }),
    ).resolves.toEqual({
      sent: false,
    });
  });

  it('hasActivePushSubscription: returns false when fetch aborts on timeout', async () => {
    global.fetch = jest.fn().mockRejectedValue(makeTimeoutError()) as unknown as typeof fetch;
    const client = new OneSignalClient();

    await expect(client.hasActivePushSubscription('user-1')).resolves.toBe(false);
  });

  it('hasActivePushSubscription: passes an AbortSignal on the user lookup', async () => {
    const fetchMock = jest.fn().mockResolvedValue(buildOkResponse({ subscriptions: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const client = new OneSignalClient();

    await client.hasActivePushSubscription('user-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit & { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
