import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { R2StorageClient } from '../../modules/storage/r2.client';

import { WorkerR2StorageClient } from './r2-storage';

const awsFetchMock = jest.fn();

jest.mock('aws4fetch', () => {
  const actual = jest.requireActual<typeof import('aws4fetch')>('aws4fetch');
  return {
    ...actual,
    AwsClient: jest.fn().mockImplementation((options) => {
      const client = new actual.AwsClient(options);
      client.fetch = awsFetchMock;
      return client;
    }),
  };
});

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual<typeof import('@aws-sdk/client-s3')>('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  };
});

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
        delete: jest.fn(async () => undefined),
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
        delete: jest.fn(async () => undefined),
      };
      const client = new WorkerR2StorageClient({ ...fullEnv, BUCKET: fakeBucket });
      await expect(client.getText('missing.txt')).rejects.toThrow(/R2 object not found/);
    });

    it('uses the R2 binding for uploadText when present', async () => {
      const fakeBucket = {
        get: jest.fn(async () => null),
        put: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
      };
      const client = new WorkerR2StorageClient({ ...fullEnv, BUCKET: fakeBucket });
      await client.uploadText('a.txt', 'hello');
      expect(fakeBucket.put).toHaveBeenCalledWith('a.txt', 'hello');
    });
  });

  describe('deleteObject', () => {
    beforeEach(() => {
      awsFetchMock.mockReset();
    });

    it('uses the R2 binding deleteObject path when present', async () => {
      const fakeBucket = {
        get: jest.fn(async () => null),
        put: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
      };
      const client = new WorkerR2StorageClient({ ...fullEnv, BUCKET: fakeBucket });

      await expect(client.deleteObject('chapters/book-1/ch-001.txt')).resolves.toBeUndefined();

      expect(fakeBucket.delete).toHaveBeenCalledWith('chapters/book-1/ch-001.txt');
      expect(awsFetchMock).not.toHaveBeenCalled();
    });

    it('treats SigV4 DELETE 404 as idempotent cleanup success', async () => {
      awsFetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn(async () => 'not found'),
      });
      const client = new WorkerR2StorageClient(fullEnv);

      await expect(client.deleteObject('chapters/book-1/missing.txt')).resolves.toBeUndefined();

      expect(awsFetchMock).toHaveBeenCalledWith(
        'https://acct123.r2.cloudflarestorage.com/novelhub-content/chapters/book-1/missing.txt',
        { method: 'DELETE' },
      );
    });

    it('throws with response body context when SigV4 DELETE returns non-2xx other than 404', async () => {
      awsFetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: jest.fn(async () => 'temporarily unavailable'),
      });
      const client = new WorkerR2StorageClient(fullEnv);

      await expect(client.deleteObject('chapters/book-1/ch-001.txt')).rejects.toThrow(
        'R2 DELETE failed (503) for chapters/book-1/ch-001.txt: temporarily unavailable',
      );
    });
  });
});

describe('R2StorageClient deleteObject', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      R2_ACCOUNT_ID: 'acct123',
      R2_ACCESS_KEY: 'AKIA_TEST_ACCESS',
      R2_SECRET_KEY: 'test-secret-key-do-not-use-in-prod',
      R2_BUCKET: 'novelhub-content',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sends a DeleteObjectCommand with configured bucket and key', async () => {
    const sendMock = jest.fn<Promise<Record<string, never>>, [DeleteObjectCommand]>(
      async () => ({}),
    );
    (S3Client as unknown as jest.Mock).mockImplementationOnce(() => ({ send: sendMock }));
    const client = new R2StorageClient();

    await expect(client.deleteObject('chapters/book-1/ch-001.txt')).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]![0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'novelhub-content',
      Key: 'chapters/book-1/ch-001.txt',
    });
  });
});
