/**
 * R2-backed StorageClient for the Cloudflare Worker. Mirrors the shape of
 * apps/api/src/modules/storage/r2.client.ts but reads credentials from the
 * Worker env bag (no `process.env` access) and prefers the R2 binding for
 * `getText`. Signed-URL generation still goes through the S3 presigner —
 * R2 bindings do not yet expose a native `createPresignedUrl` API.
 *
 * Shape contract: implements the same `StorageClient` interface used by
 * `ChaptersService`, so the same service file runs on both stacks.
 *
 * Failure mode: if R2 credentials / binding are absent, calls throw.
 * `ChaptersService` already wraps storage calls in try/catch for the
 * preview path (graceful empty-string fallback) and the signed-URL path
 * (falls back to the raw key), so a misconfigured Worker degrades to
 * "no preview / no signed URL" rather than 500.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  SIGNED_URL_TTL_SECONDS,
  type StorageClient,
} from '../../modules/storage/storage.constants';

export type R2StorageEnv = {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY?: string;
  R2_SECRET_KEY?: string;
  R2_BUCKET?: string;
  // R2 binding (declared in wrangler.toml as `binding = "BUCKET"`). When
  // present, used for getText / uploadText to avoid an extra HTTP hop.
  BUCKET?: R2Bucket;
};

// Minimal subset of the R2 binding API (apps/api/src/types/r2.d.ts is not
// yet generated; this declaration keeps the typecheck happy without pulling
// in @cloudflare/workers-types as a runtime dep).
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, body: string | ArrayBuffer | ReadableStream): Promise<unknown>;
}
interface R2ObjectBody {
  text(): Promise<string>;
}

export class WorkerR2StorageClient implements StorageClient {
  constructor(private readonly env: R2StorageEnv) {}

  async uploadText(key: string, content: string): Promise<void> {
    if (this.env.BUCKET) {
      await this.env.BUCKET.put(key, content);
      return;
    }
    const { client, bucket } = this.requireSdk();
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
    const { client, bucket } = this.requireSdk();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const { client, bucket } = this.requireSdk();
    return getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
  }

  async getText(key: string): Promise<string> {
    if (this.env.BUCKET) {
      const obj = await this.env.BUCKET.get(key);
      if (!obj) throw new Error(`R2 object not found: ${key}`);
      return obj.text();
    }
    const { client, bucket } = this.requireSdk();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty body for ${key}`);
    return res.Body.transformToString('utf-8');
  }

  private requireSdk(): { client: S3Client; bucket: string } {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET } = this.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
      throw new Error(
        'R2 storage is not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET).',
      );
    }
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
    });
    return { client, bucket: R2_BUCKET };
  }
}
