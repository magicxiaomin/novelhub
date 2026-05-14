const legacyPublicApiUrl = (): string | undefined => process.env.NEXT_PUBLIC_API_URL;
const canonicalPublicApiBaseUrl = (): string | undefined => process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Public API base used by browser bundles and RSC helpers.
 *
 * NEXT_PUBLIC_API_BASE_URL is the Phase 3 canonical name. NEXT_PUBLIC_API_URL
 * remains supported so existing NovelHub deployments do not break during the
 * public web / API cutover.
 */
export const publicApiBaseUrl = (): string =>
  canonicalPublicApiBaseUrl() ?? legacyPublicApiUrl() ?? 'http://localhost:4000';

export const internalApiBaseUrl = (): string =>
  process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
