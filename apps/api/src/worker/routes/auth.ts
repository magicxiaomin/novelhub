/**
 * Hono auth routes — mirror the surface of
 * apps/api/src/modules/auth/auth.controller.ts on `:8787`.
 *
 * Task 3.1 shipped register/login/refresh/logout/me/forgot/reset; Task 3.2
 * formalises the body validation as Zod schemas via @hono/zod-validator.
 * Two routes are still deferred:
 *   - `POST /auth/google` (needs FB-CAPI consent path + GOOGLE_CLIENT_ID).
 *   - `DELETE /auth/account` (consumes the Stripe client).
 */
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

import { zValidator } from '@hono/zod-validator';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_REFRESH } from '../../modules/auth/auth.constants';
import { clearAuthCookies, setAuthCookies } from '../cookies';
import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validationHook } from '../middleware/validator';
import { makeAuthService, type WorkerEnv } from '../services/auth-factory';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas';

type Bindings = WorkerEnv;

const isProd = (env: WorkerEnv): boolean => env.NODE_ENV === 'production';

export const authRoutes = new Hono<{
  Bindings: Bindings;
  Variables: PrismaVariables & Partial<AuthVariables>;
}>()
  .post('/register', zValidator('json', registerSchema, validationHook), async (c) => {
    const { email, password } = c.req.valid('json');
    const auth = makeAuthService(c.env, c.get('prisma'));
    const result = await auth.register(email, password);
    setAuthCookies(c, result.tokens, isProd(c.env));
    return c.json({ user: result.user }, 201);
  })
  .post('/login', zValidator('json', loginSchema, validationHook), async (c) => {
    const { email, password } = c.req.valid('json');
    const auth = makeAuthService(c.env, c.get('prisma'));
    const result = await auth.login(email, password);
    setAuthCookies(c, result.tokens, isProd(c.env));
    return c.json({ user: result.user }, 200);
  })
  .post('/refresh', async (c) => {
    const refreshToken = getCookie(c, COOKIE_REFRESH);
    if (!refreshToken) {
      throw new HTTPException(401, { message: 'Missing refresh token' });
    }
    const auth = makeAuthService(c.env, c.get('prisma'));
    const tokens = await auth.refresh(refreshToken);
    setAuthCookies(c, tokens, isProd(c.env));
    return c.json({ refreshed: true }, 200);
  })
  .post('/logout', (c) => {
    clearAuthCookies(c, isProd(c.env));
    return c.json({ ok: true }, 200);
  })
  .get('/me', requireAuth, async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });
    const auth = makeAuthService(c.env, c.get('prisma'));
    const fresh = await auth.getCurrentUser(user.id);
    return c.json({ user: fresh }, 200);
  })
  .post('/forgot-password', zValidator('json', forgotPasswordSchema, validationHook), async (c) => {
    const { email } = c.req.valid('json');
    const auth = makeAuthService(c.env, c.get('prisma'));
    await auth.forgotPassword(email);
    return c.body(null, 204);
  })
  .post('/reset-password', zValidator('json', resetPasswordSchema, validationHook), async (c) => {
    const { token, password } = c.req.valid('json');
    const auth = makeAuthService(c.env, c.get('prisma'));
    await auth.resetPassword(token, password);
    return c.body(null, 204);
  });

/**
 * Translates an `DomainError` thrown by `AuthService` into the matching
 * `HTTPException`. Wired via `app.onError` in worker.ts. Mirrors
 * `apps/api/src/modules/auth/auth-error.filter.ts`.
 */
export function mapDomainError(err: unknown): HTTPException | null {
  if (!(err instanceof DomainError)) return null;
  return new HTTPException(err.status, { message: err.message });
}
