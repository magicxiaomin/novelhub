import { LocalStorageClient } from './local.client';

describe('LocalStorageClient', () => {
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (previousApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
  });

  describe('getSignedUrl', () => {
    it('returns a localhost static URL when NEXT_PUBLIC_API_URL is unset', async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      const client = new LocalStorageClient();

      await expect(client.getSignedUrl('chapters/x/chapter-01.txt')).resolves.toBe(
        'http://localhost:4000/static/chapters/x/chapter-01.txt',
      );
    });

    it('honors a NEXT_PUBLIC_API_URL override', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
      const client = new LocalStorageClient();

      await expect(client.getSignedUrl('chapters/x/chapter-01.txt')).resolves.toBe(
        'https://api.example.test/static/chapters/x/chapter-01.txt',
      );
    });

    it('strips a trailing slash from NEXT_PUBLIC_API_URL', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test/';
      const client = new LocalStorageClient();

      await expect(client.getSignedUrl('chapters/x/chapter-01.txt')).resolves.toBe(
        'https://api.example.test/static/chapters/x/chapter-01.txt',
      );
    });
  });

  describe('getSignedUploadUrl', () => {
    it('throws because local presigned uploads are not implemented', async () => {
      const client = new LocalStorageClient();

      await expect(
        client.getSignedUploadUrl('chapters/x/chapter-01.txt', 'text/plain'),
      ).rejects.toThrow(/not implemented in LocalStorageClient/);
    });
  });
});
