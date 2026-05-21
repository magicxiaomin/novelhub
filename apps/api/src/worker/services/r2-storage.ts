/**
 * R2-backed StorageClient for the Cloudflare Worker. Mirrors the shape of
 * apps/api/src/modules/storage/r2.client.ts but uses Cloudflare-native
 * primitives instead of the AWS SDK:
 *
 *   - `uploadText` / `getText` go through the R2 binding (`env.BUCKET`)
 *     when present — no HTTP round-trip, no SigV4 overhead.
 *   - `getSignedUrl` / `getSignedUploadUrl` use `aws4fetch` (~5 KB) for
 *     SigV4 query-string signing. The AWS SDK (`@aws-sdk/client-s3` plus
 *     `@aws-sdk/s3-request-presigner`) is ~150 KB and pulls in
 *     `nodejs_compat`-shimmed deps; aws4fetch is purpose-built for the
 *     Workers runtime and uses Web Crypto under the hood.
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
import { AwsClient } from 'aws4fetch';

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

// Minimal subset of the R2 binding API (avoid pulling in
// @cloudflare/workers-types as a runtime dep just for two methods).
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, body: string | ArrayBuffer | ReadableStream): Promise<unknown>;
  delete(key: string): Promise<void>;
}
interface R2ObjectBody {
  text(): Promise<string>;
}

const encodeKey = (key: string): string =>
  // S3 keys must be percent-encoded per segment, but '/' MUST stay unescaped
  // — splitting on '/' and rejoining preserves prefix layout (e.g. chapters/<bookId>/<id>.txt).
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export class WorkerR2StorageClient implements StorageClient {
  constructor(private readonly env: R2StorageEnv) {}

  async uploadText(key: string, content: string): Promise<void> {
    if (this.env.BUCKET) {
      await this.env.BUCKET.put(key, content);
      return;
    }
    const aws = this.requireAwsClient();
    const url = this.objectUrl(key);
    const res = await aws.fetch(url, {
      method: 'PUT',
      body: content,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`R2 PUT failed (${res.status}) for ${key}: ${body}`);
    }
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    return this.signQueryUrl('GET', key, expiresInSeconds);
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    return this.signQueryUrl('PUT', key, expiresInSeconds, contentType);
  }

  async getText(key: string): Promise<string> {
    if (this.env.BUCKET) {
      const obj = await this.env.BUCKET.get(key);
      if (!obj) throw new Error(`R2 object not found: ${key}`);
      return obj.text();
    }
    const aws = this.requireAwsClient();
    const res = await aws.fetch(this.objectUrl(key));
    if (!res.ok) {
      throw new Error(`R2 GET failed (${res.status}) for ${key}`);
    }
    return res.text();
  }

  async deleteObject(key: string): Promise<void> {
    if (this.env.BUCKET) {
      await this.env.BUCKET.delete(key);
      return;
    }
    const aws = this.requireAwsClient();
    const res = await aws.fetch(this.objectUrl(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new Error(`R2 DELETE failed (${res.status}) for ${key}: ${body}`);
    }
  }

  private requireAwsClient(): AwsClient {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET } = this.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
      throw new Error(
        'R2 storage is not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET).',
      );
    }
    return new AwsClient({
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
      service: 's3',
      // R2 expects the literal "auto" region in SigV4 to bypass region
      // verification — same value the AWS SDK path used.
      region: 'auto',
    });
  }

  // Path-style endpoint matches what the AWS SDK presigner produces for R2
  // when constructed with `endpoint: https://<account>.r2.cloudflarestorage.com`.
  // Frontend code that reads chapter content is host-allowlisted on the
  // `*.r2.cloudflarestorage.com` pattern (see PR #60), so keep the host
  // shape stable through the migration.
  private objectUrl(key: string): string {
    const { R2_ACCOUNT_ID, R2_BUCKET } = this.env;
    return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeKey(key)}`;
  }

  private async signQueryUrl(
    method: 'GET' | 'PUT',
    key: string,
    expiresInSeconds: number,
    contentType?: string,
  ): Promise<string> {
    const aws = this.requireAwsClient();
    // SigV4 query-string signing: aws4fetch sets X-Amz-Expires, X-Amz-Date,
    // X-Amz-Signature, etc. on the URL searchParams when `signQuery: true`.
    // Set X-Amz-Expires up-front so the default of 86400s does not apply.
    const url = new URL(this.objectUrl(key));
    url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));
    if (method === 'PUT' && contentType) {
      // The Content-Type travels in headers for presigned PUTs and the
      // signature must include it; aws4fetch picks up Content-Type when
      // it is in the `headers` arg.
      url.searchParams.set('content-type', contentType);
    }
    const init: RequestInit & { aws: { signQuery: true; allHeaders?: boolean } } = {
      method,
      aws: { signQuery: true },
    };
    if (method === 'PUT' && contentType) {
      init.headers = { 'Content-Type': contentType };
      // aws4fetch's default UNSIGNABLE_HEADERS skips content-type. For
      // presigned PUTs, S3/R2 must verify the uploaded body's Content-Type
      // matches the signed value, so opt into all-header signing.
      init.aws.allHeaders = true;
    }
    const signed = await aws.sign(url.toString(), init);
    return signed.url;
  }
}
