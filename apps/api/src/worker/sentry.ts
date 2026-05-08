/**
 * Sentry integration for the Cloudflare Worker runtime.
 *
 * The Nest stack pre-imports `instrument.ts` (which calls `Sentry.init`
 * before any other module loads) so @sentry/node v10 can patch
 * express/prisma/etc at require-time. Workers don't run Node, so the
 * @sentry/node auto-instrumentation flow doesn't apply — we use
 * @sentry/cloudflare's `withSentry` higher-order handler instead, which
 * builds a fresh Sentry hub per request and captures any thrown error.
 *
 * Wire-up parity vs Nest:
 *
 *   - Nest:    apps/api/src/instrument.ts      Sentry.init(...)
 *              SentryExceptionFilter           captures 5xx via captureException
 *              SentryUserInterceptor           setUser on isolation scope
 *
 *   - Worker:  this file                       Sentry.withSentry(optsFn, handler)
 *              captureWorkerException          mirror of the 5xx capture
 *              setSentryUser                   helper called from requireAuth
 */
import { scrubSentryEvent } from '@novelhub/shared';
import * as Sentry from '@sentry/cloudflare';

import { DomainError } from '../common/domain.errors';

type SentryEnv = {
  SENTRY_DSN?: string;
  NODE_ENV?: string;
};

/**
 * Builds the per-request Sentry options bag. Mirrors `instrument.ts`
 * settings 1:1 — same DSN env, same `beforeSend` scrubber, same
 * production trace sample rate.
 *
 * Returns `null` (instead of `undefined`) when the DSN is not set so
 * `withSentry` can short-circuit without a runtime cost.
 */
export const buildSentryOptions = (env: SentryEnv): Sentry.CloudflareOptions => ({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV ?? 'development',
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  sendDefaultPii: false,
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
});

/**
 * Mirror of SentryExceptionFilter: capture 5xx and unknown errors,
 * skip 4xx domain errors. Called from `app.onError` in worker.ts.
 *
 * `Sentry.withSentry` already auto-captures uncaught throws, but our
 * `app.onError` swallows them to render the JSON envelope, so we have
 * to re-emit explicitly here.
 */
export const captureWorkerException = (err: unknown, env: SentryEnv): void => {
  if (!env.SENTRY_DSN) return;
  // 4xx DomainErrors are user errors — same gate as the Nest filter.
  if (err instanceof DomainError && err.status < 500) return;
  Sentry.captureException(err);
};

/**
 * Mirror of SentryUserInterceptor: pin the per-request isolation scope
 * to `{ id: userId }`. Called from auth middleware right after a
 * successful token verification.
 *
 * `getIsolationScope` (not `getCurrentScope`) is the documented
 * per-request boundary — same reasoning as the Nest interceptor.
 */
export const setSentryUser = (env: SentryEnv, userId: string | null): void => {
  if (!env.SENTRY_DSN) return;
  Sentry.getIsolationScope().setUser(userId ? { id: userId } : null);
};

export { Sentry };
