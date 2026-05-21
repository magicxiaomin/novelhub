const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { SupportService } from '../../modules/support/support.service';
import { KvCacheClient, type KVNamespace } from './kv-cache';

const makeFakeKV = (): { kv: KVNamespace; store: Map<string, string> } => {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      put: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      delete: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  };
};

describe('KvCacheClient', () => {
  it('round-trips JSON-encoded values', async () => {
    const { kv, store } = makeFakeKV();
    const cache = new KvCacheClient(kv);

    await cache.set('key1', { hello: 'world', n: 42 });
    expect(store.get('key1')).toBe('{"hello":"world","n":42}');

    const got = await cache.get<{ hello: string; n: number }>('key1');
    expect(got).toEqual({ hello: 'world', n: 42 });
  });

  it('returns null for unset keys', async () => {
    const { kv } = makeFakeKV();
    const cache = new KvCacheClient(kv);
    expect(await cache.get('missing')).toBeNull();
  });

  it('passes expirationTtl through, bumping below-minimum TTLs to KV minimum (60s)', async () => {
    const { kv } = makeFakeKV();
    const cache = new KvCacheClient(kv);

    await cache.set('a', 1, 30);
    expect(kv.put).toHaveBeenLastCalledWith('a', '1', { expirationTtl: 60 });

    await cache.set('b', 2, 3600);
    expect(kv.put).toHaveBeenLastCalledWith('b', '2', { expirationTtl: 3600 });

    // No TTL → call put without options so the value lives forever
    await cache.set('c', 3);
    expect(kv.put).toHaveBeenLastCalledWith('c', '3', undefined);
  });

  it('deletes keys', async () => {
    const { kv, store } = makeFakeKV();
    store.set('x', '"v"');
    const cache = new KvCacheClient(kv);
    await cache.del('x');
    expect(store.has('x')).toBe(false);
  });

  it('returns null when stored value is corrupt (non-JSON)', async () => {
    const { kv, store } = makeFakeKV();
    store.set('bad', 'this-is-not-json');
    const cache = new KvCacheClient(kv);
    expect(await cache.get('bad')).toBeNull();
  });
});

describe('SupportService backed by KvCacheClient', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    mockSend.mockReset();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: 're_test',
      SUPPORT_EMAIL: 'support@example.com',
      SUPPORT_FROM_EMAIL: 'NovelHub <noreply@example.com>',
    };
    mockSend.mockResolvedValue({ id: 'msg_1' });
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it('counts contact submissions across calls — 4th call is rate-limited', async () => {
    const { kv } = makeFakeKV();
    const cache = new KvCacheClient(kv);
    const service = new SupportService(cache);
    const dto = {
      name: 'Reader',
      email: 'spammer@example.com',
      subject: 'Hi',
      body: 'Body',
    };

    // First three submissions succeed
    await expect(service.contact(dto)).resolves.toEqual({ delivered: true });
    await expect(service.contact(dto)).resolves.toEqual({ delivered: true });
    await expect(service.contact(dto)).resolves.toEqual({ delivered: true });

    // KV now holds counter=3; fourth call hits the cap
    await expect(service.contact(dto)).rejects.toMatchObject({ status: 429 });
  });

  it('refreshes TTL on every successful submission so a slow attacker cannot creep over the cap', async () => {
    const { kv } = makeFakeKV();
    const cache = new KvCacheClient(kv);
    const service = new SupportService(cache);

    await service.contact({
      name: 'A',
      email: 'a@example.com',
      subject: 'S',
      body: 'B',
    });
    await service.contact({
      name: 'A',
      email: 'a@example.com',
      subject: 'S',
      body: 'B',
    });

    // TTL refreshed to the full window each time (24h = 86400 s).
    const putCalls = (kv.put as jest.Mock).mock.calls;
    const ttls = putCalls
      .filter(([key]) => key === 'support:contact:a@example.com')
      .map(([, , opts]) => opts?.expirationTtl);
    expect(ttls).toEqual([86400, 86400]);
  });

  it('lowercased+trimmed email keys share one budget across case variants', async () => {
    const { kv } = makeFakeKV();
    const cache = new KvCacheClient(kv);
    const service = new SupportService(cache);

    await service.contact({
      name: 'A',
      email: '  Reader@Example.COM  ',
      subject: 'S',
      body: 'B',
    });
    await service.contact({
      name: 'A',
      email: 'reader@example.com',
      subject: 'S',
      body: 'B',
    });
    await service.contact({
      name: 'A',
      email: 'READER@example.com',
      subject: 'S',
      body: 'B',
    });
    await expect(
      service.contact({ name: 'A', email: 'reader@example.com', subject: 'S', body: 'B' }),
    ).rejects.toMatchObject({ status: 429 });

    expect(kv.get).toHaveBeenCalledWith('support:contact:reader@example.com');
  });
});
