import { Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { SIGNED_URL_TTL_SECONDS, type StorageClient } from './storage.constants';

/**
 * Production storage client backed by Cloudflare R2 via the S3 protocol.
 * Reads R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY / R2_BUCKET from env
 * lazily so the module can boot without R2 configured (e.g. in CI / tests).
 */
export class R2StorageClient implements StorageClient {
  private readonly logger = new Logger(R2StorageClient.name);
  private cachedClient: S3Client | null = null;

  async uploadText(key: string, content: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: 'text/plain; charset=utf-8',
      }),
    );
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const { client, bucket } = this.requireClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const { client, bucket } = this.requireClient();
    return getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getText(key: string): Promise<string> {
    const { client, bucket } = this.requireClient();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) {
      throw new Error(`Empty body for ${key}`);
    }
    const text = await res.Body.transformToString('utf-8');
    return text;
  }

  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  private requireClient(): { client: S3Client; bucket: string } {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKey = process.env.R2_ACCESS_KEY;
    const secretKey = process.env.R2_SECRET_KEY;
    const bucket = process.env.R2_BUCKET;
    if (!accountId || !accessKey || !secretKey || !bucket) {
      throw new Error(
        'R2 storage is not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET).',
      );
    }
    if (!this.cachedClient) {
      this.cachedClient = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      });
      this.logger.log(`R2 client initialized for bucket ${bucket}`);
    }
    return { client: this.cachedClient, bucket };
  }
}
