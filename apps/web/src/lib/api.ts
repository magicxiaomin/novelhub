/**
 * Browser-side API client.
 *
 * - Sends cookies automatically (`credentials: 'include'`) so the JWT cookie
 *   set by the API on login flows through.
 * - On a 401 from a guarded endpoint, callers can react via React Query's
 *   `enabled` / `retry` options; we don't auto-redirect here because pages
 *   like Home want to render anonymously when the auth check 401s.
 *
 * The base URL is read from `NEXT_PUBLIC_API_BASE_URL`, falling back to the
 * legacy `NEXT_PUBLIC_API_URL`. It defaults to localhost:4000 matching
 * apps/api's default port.
 */
import { publicApiBaseUrl } from './api-config';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const getBaseUrl = (): string => publicApiBaseUrl();

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

const buildUrl = (
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getBaseUrl();
  const url = baseUrl.startsWith('/')
    ? new URL(`${baseUrl}${normalizedPath}`, window.location.origin)
    : new URL(normalizedPath, baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return baseUrl.startsWith('/') ? `${url.pathname}${url.search}` : url.toString();
};

export async function apiFetch<T>(
  path: string,
  init: RequestOptions & { query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const { body, query, headers, ...rest } = init;
  const res = await fetch(buildUrl(path, query), {
    credentials: 'include',
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      (typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : null) ?? `Request failed: ${res.status}`;
    throw new ApiError(message, res.status, parsed);
  }
  return parsed as T;
}
