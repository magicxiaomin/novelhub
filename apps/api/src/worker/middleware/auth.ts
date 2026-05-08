/**
 * Hono middleware for the Worker auth surface — mirrors the semantics of
 * apps/api/src/modules/auth/{strategies/jwt.strategy,guards/*}.ts:
 *
 *   - `requireAuth`     → 401 when cookie missing/invalid; sets c.var.user.
 *   - `optionalAuth`    → never 401; sets c.var.user when verifiable.
 *   - `requireAdmin`    → composes requireAuth + checks user.isAdmin.
 *
 * Token verification is via `JoseJwtClient` against `env.JWT_SECRET`. User
 * identity is loaded from the per-request Prisma client (set on `c.var` by
 * `prismaMiddleware`) so soft-deleted/banned accounts cannot leverage a
 * still-valid token.
 */
import type { PrismaClient } from '@prisma/client';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { WorkerEnv } from '../services/auth-factory';

export type AuthedUser = {
  id: string;
  email: string;
  isAdmin: boolean;
};

export type AuthVariables = PrismaVariables & {
  user: AuthedUser;
};

const readToken = (c: Context): string | null => {
  const cookie = getCookie(c, COOKIE_ACCESS);
  if (cookie) return cookie;
  const header = c.req.header('Authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

// `resolveUser` takes only what it needs (env + raw request + prisma client),
// not a typed Hono Context. This sidesteps Hono's invariant Variables
// generic — both `requireAuth` (where Variables = AuthVariables) and
// `optionalAuth` (where Variables = Partial<AuthVariables>) read prisma
// off c.get('prisma') and pass it in plain.
async function resolveUser(
  env: WorkerEnv,
  token: string | null,
  prisma: PrismaClient,
): Promise<AuthedUser | null> {
  if (!token) return null;

  const jwt = new JoseJwtClient(env.JWT_SECRET ?? 'dev-secret-change-me');
  let payload: JwtPayload;
  try {
    payload = await jwt.verifyAsync<JwtPayload>(token);
  } catch {
    return null;
  }
  if (payload.type !== 'access' || !payload.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, deletedAt: true, bannedAt: true, isAdmin: true },
  });
  if (!user || user.deletedAt || user.bannedAt) return null;
  return { id: user.id, email: user.email, isAdmin: user.isAdmin };
}

export const requireAuth: MiddlewareHandler<{
  Bindings: WorkerEnv;
  Variables: AuthVariables;
}> = async (c, next) => {
  const user = await resolveUser(c.env, readToken(c), c.get('prisma'));
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  c.set('user', user);
  await next();
};

export const optionalAuth: MiddlewareHandler<{
  Bindings: WorkerEnv;
  Variables: Partial<AuthVariables>;
}> = async (c, next) => {
  const prisma = c.get('prisma');
  if (prisma) {
    const user = await resolveUser(c.env, readToken(c), prisma);
    if (user) c.set('user', user);
  }
  await next();
};

export const requireAdmin: MiddlewareHandler<{
  Bindings: WorkerEnv;
  Variables: AuthVariables;
}> = async (c, next) => {
  const user = await resolveUser(c.env, readToken(c), c.get('prisma'));
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  if (!user.isAdmin) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  c.set('user', user);
  await next();
};
