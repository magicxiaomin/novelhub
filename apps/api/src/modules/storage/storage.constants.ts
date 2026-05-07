export const STORAGE_CLIENT = Symbol('STORAGE_CLIENT');

export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface StorageClient {
  uploadText(key: string, content: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  getText(key: string): Promise<string>;
}
