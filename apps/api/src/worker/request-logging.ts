import type { MiddlewareHandler } from 'hono';

export type ReadPathLogLine = {
  event: 'worker.read_request';
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

const randomRequestId = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `req_${Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 24)}`;
};

export const makeRequestId = (incoming: string | null | undefined): string => {
  const candidate = incoming?.trim();
  if (candidate && REQUEST_ID_PATTERN.test(candidate)) return candidate;
  return randomRequestId();
};

export const requestIdAndStructuredReadLog = (): MiddlewareHandler => async (c, next) => {
  const requestId = makeRequestId(c.req.header(REQUEST_ID_HEADER));
  const started = Date.now();

  try {
    await next();
  } finally {
    c.header(REQUEST_ID_HEADER, requestId);
    const logLine: ReadPathLogLine = {
      event: 'worker.read_request',
      requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Math.max(0, Date.now() - started),
    };
    // eslint-disable-next-line no-console
    console.info(JSON.stringify(logLine));
  }
};
