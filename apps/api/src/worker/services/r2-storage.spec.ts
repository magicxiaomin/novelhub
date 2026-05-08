import { WorkerR2StorageClient } from './r2-storage';

describe('WorkerR2StorageClient', () => {
  const fullEnv = {
    R2_ACCOUNT_ID: 'acct123',
    R2_ACCESS_KEY: 'AKIA_TEST_ACCESS',
    R2_SECRET_KEY: 'test-secret-key-do-not-use-in-prod',
    R2_BUCKET: 'novelhub-content',
  };

  describe('getSignedUrl (SigV4 query signing)', () => {
    it('returns a path-style URL with X-Amz-Expires + X-Amz-Signature query params', async () => {
      const client = new WorkerR2StorageClient(fullEnv);
      const signed = await client.getSignedUrl('chapters/book-1/ch-001.txt', 3600);
      const url = new URL(signed);

      // Hostname matches what AWS SDK produces for R2 (path-style).
      expect(url.hostname).toBe('acct123.r2.cloudflarestorage.com');
      // Path includes bucket + key, with `/` segments preserved.
      expect(url.pathname).toBe('/novelhub-content/chapters/book-1/ch-001.txt');

      // SigV4 query params present.
      expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
      expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
      expect(url.searchParams.get('X-Amz-Credential')).toMatch(/^AKIA_TEST_ACCESS\//);
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('host');
      expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
      expect(url.searchParams.get('X-Amz-Date')).toMatch(/^\d{8}T\d{6}Z$/);
    });

    it('honours the default 1h TTL when expiresInSeconds is omitted', async () => {
      const client = new WorkerR2StorageClient(fullEnv);
      const signed = await client.getSignedUrl('a.txt');
      expect(new URL(signed).searchParams.get('X-Amz-Expires')).toBe('3600');
    });

    it('percent-encodes special chars in keys but preserves path separators', async () => {
      const client = new WorkerR2StorageClient(fullEnv);
      const signed = await client.getSignedUrl('chapters/book one/ch & space.txt');
      const url = new URL(signed);
      expect(url.pathname).toBe('/novelhub-content/chapters/book%20one/ch%20%26%20space.txt');
    });
  });

  describe('getSignedUploadUrl (presigned PUT)', () => {
    it('signs a PUT URL with the requested content-type', async () => {
      const client = new WorkerR2StorageClient(fullEnv);
      const signed = await client.getSignedUploadUrl('covers/x.jpg', 'image/jpeg', 1800);
      const url = new URL(signed);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('1800');
      expect(url.searchParams.get('content-type')).toBe('image/jpeg');
      // Signed headers include content-type so the upload must send the
      // matching header back.
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
    });
  });

  describe('credential / binding requirements', () => {
    it('throws a helpful error when R2 creds are missing', async () => {
      const client = new WorkerR2StorageClient({});
      await expect(client.getSignedUrl('a.txt')).rejects.toThrow(/R2 storage is not configured/);
    });

    it('uses the R2 binding for getText when present (no SigV4 round-trip)', async () => {
      const fakeBucket = {
        get: jest.fn(async () => ({
          text: async () => 'hello world',
        })),
        put: jest.fn(async () => undefined),
      };
      const client = new WorkerR2StorageClient({ ...fullEnv, BUCKET: fakeBucket });
      const text = await client.getText('a.txt');
      expect(text).toBe('hello world');
      expect(fakeBucket.get).toHaveBeenCalledWith('a.txt');
    });

    it('throws when getText hits the binding and the object is missing', async () => {
      const fakeBucket = {
        get: jest.fn(async () => null),
        put: jest.fn(async () => undefined),
      };
      const client = new WorkerR2StorageClient({ ...fullEnv, BUCKET: fakeBucket });
      await expect(client.getText('missing.txt')).rejects.toThrow(/R2 object not found/);
    });

    it('uses the R2 binding for uploadText when present', async () => {
      const fakeBucket = {
        get: jest.fn(async () => null),
        put: jest.fn(async () => undefined),
      };
      const client = new WorkerR2StorageClient({ ...fullEnv, BUCKET: fakeBucket });
      await client.uploadText('a.txt', 'hello');
      expect(fakeBucket.put).toHaveBeenCalledWith('a.txt', 'hello');
    });
  });
});
