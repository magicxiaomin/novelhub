import type { FbCapiRequest } from './fb-capi.service';

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.split('=');
    const name = rawName?.trim();
    if (!name) continue;
    cookies[name] = rawValue.join('=').trim();
  }
  return cookies;
}

export function buildFbCapiRequestFromHeaders(input: {
  cookieHeader: string | undefined;
  ip?: string;
  userAgent?: string;
}): FbCapiRequest {
  return {
    cookies: parseCookieHeader(input.cookieHeader),
    ip: input.ip,
    headers: {
      'user-agent': input.userAgent,
    },
  };
}
