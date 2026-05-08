/**
 * Hono auth routes — mirror the surface of
 * apps/api/src/modules/auth/auth.controller.ts on `:8787`.
 *
 * Task 3.1 ships register/login/refresh/logout/me/forgot/reset. Two routes
 * are deferred:
 *   - `POST /auth/google` (needs FB-CAPI consent path + GOOGLE_CLIENT_ID).
 *   - `DELETE /auth/account` (consumes the Stripe client).
 *
 * Body validation is intentionally light here — Zod schemas land in
 * Task 3.2 via `@hono/zod-validator`.
 */
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

import { AuthError } from '../../modules/auth/auth.errors';
import { COOKIE_REFRESH } from '../../modules/auth/auth.constants';
import { clearAuthCookies, setAuthCookies } from '../cookies';
import type { PrismaVariables } from '../db/prisma';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { makeAuthService, type WorkerEnv } from '../services/auth-factory';

type Bindings = WorkerEnv;

// Light-touch validators replaced by Zod in Task 3.2.
const isEmail = (s: unknown): s is string =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const isPassword = (s: unknown): s is string =>
  typeof s === 'string' && s.length >= 8 && s.length <= 200;

const isProd = (env: WorkerEnv): boolean => env.NODE_ENV === 'production';

export const authRoutes = new Hono<{
  Bindings: Bindings;
  Variables: PrismaVariables & Partial<AuthVariables>;
}>()
  .post('/register', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!isEmail(body.email) || !isPassword(body.password)) {
      throw new HTTPException(400, { message: 'Invalid email or password' });
    }
    const auth = makeAuthService(c.env, c.get('prisma'));
    const result = await auth.register(body.email, body.password);
    setAuthCookies(c, result.tokens, isProd(c.env));
    return c.json({ user: result.user }, 201);
  })
  .post('/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!isEmail(body.email) || !isPassword(body.password)) {
      throw new HTTPException(400, { message: 'Invalid email or password' });
    }
    const auth = makeAuthService(c.env, c.get('prisma'));
    const result = await auth.login(body.email, body.password);
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
  .post('/forgot-password', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!isEmail(body.email)) {
      throw new HTTPException(400, { message: 'Invalid email' });
    }
    const auth = makeAuthService(c.env, c.get('prisma'));
    await auth.forgotPassword(body.email);
    return c.body(null, 204);
  })
  .post('/reset-password', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.token !== 'string' || !body.token) {
      throw new HTTPException(400, { message: 'Reset link is invalid or expired' });
    }
    if (!isPassword(body.password)) {
      throw new HTTPException(400, { message: 'Password must be 8+ characters' });
    }
    const auth = makeAuthService(c.env, c.get('prisma'));
    await auth.resetPassword(body.token, body.password);
    return c.body(null, 204);
  });

/**
 * Translates an `AuthError` thrown by `AuthService` into the matching
 * `HTTPException`. Wired via `app.onError` in worker.ts. Mirrors
 * `apps/api/src/modules/auth/auth-error.filter.ts`.
 */
export function mapAuthError(err: unknown): HTTPException | null {
  if (!(err instanceof AuthError)) return null;
  return new HTTPException(err.status, { message: err.message });
}
