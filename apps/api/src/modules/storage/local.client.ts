import { Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { type StorageClient } from './storage.constants';

/**
 * Dev-mode StorageClient. Resolves an R2 key (e.g. "chapters/<book>/chapter-01.txt")
 * to the API's local /static URL so the reader can fetch chapter text without R2.
 *
 * The Nest dev server (apps/api/src/main.ts) mounts apps/api/static/ at /static/,
 * so an R2 key 1:1 maps to a path under that root. NEXT_PUBLIC_API_URL controls
 * the base host (defaults to http://localhost:4000).
 */
export class LocalStorageClient implements StorageClient {
  private readonly logger = new Logger(LocalStorageClient.name);

  async uploadText(key: string, content: string): Promise<void> {
    // Dev-only: write to apps/api/static/<key> so seeded data survives a restart.
    const target = this.localPathFor(key);
    await fs.mkdir(target.replace(/\/[^/]+$/, ''), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
    this.logger.debug(`Wrote local storage object: ${key}`);
  }

  async getSignedUrl(key: string): Promise<string> {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return `${base.replace(/\/$/, '')}/static/${key}`;
  }

  async getSignedUploadUrl(key: string, contentType: string): Promise<string> {
    void key;
    void contentType;
    throw new Error('getSignedUploadUrl is not implemented in LocalStorageClient (dev only)');
  }

  async getText(key: string): Promise<string> {
    return fs.readFile(this.localPathFor(key), 'utf-8');
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await fs.unlink(this.localPathFor(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  private localPathFor(key: string): string {
    // apps/api compiled to dist/, __dirname-style resolution through process.cwd()
    // is fragile; instead, anchor at process.cwd() (which is apps/api in dev).
    const root = process.env.STATIC_ROOT ?? join(process.cwd(), 'static');
    return join(root, key);
  }
}
