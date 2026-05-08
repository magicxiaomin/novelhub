/**
 * Validation hook for `@hono/zod-validator` that throws DomainError on
 * failure so `app.onError` in worker.ts renders the same `{statusCode,
 * message, error}` envelope the Nest ValidationPipe produces.
 *
 * Routes pass `validationHook` as the third argument to upstream
 * `zValidator(...)`:
 *
 *   import { zValidator } from '@hono/zod-validator';
 *   import { validationHook } from '../middleware/validator';
 *   ...zValidator('query', schema, validationHook)
 *
 * (We pass the hook explicitly rather than wrapping `zValidator` itself
 * because the upstream type carries 8 generics that don't survive a thin
 * wrapper without losing inference inside chained Hono builders.)
 */
import type { Hook } from '@hono/zod-validator';
import type { Env } from 'hono';

import { DomainError } from '../../common/domain.errors';

export const validationHook: Hook<unknown, Env, string> = (result) => {
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
    throw DomainError.badRequest(message);
  }
};
