import { Hono } from 'hono';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeAuthService, type WorkerEnv } from '../services/auth-factory';
import { authRoutes } from './auth';

jest.mock('../services/auth-factory', () => ({
  makeAuthService: jest.fn(),
}));

const mockedMakeAuthService = jest.mocked(makeAuthService);

const env = {
  JWT_SECRET: 'contract-access-secret',
  NODE_ENV: 'test',
} as WorkerEnv;

const splitSetCookieHeader = (header: string | null): string[] => {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,]+=)/).map((part) => part.trim());
};

const json = async (res: Response): Promise<unknown> => res.json();

const buildPrisma = () =>
  ({
    user: {
      findUnique: jest.fn(async () => ({
        id: 'user-1',
        email: 'reader@example.com',
        deletedAt: null,
        bannedAt: null,
        isAdmin: false,
      })),
    },
  }) as unknown as PrismaVariables['prisma'];

const buildApp = (prisma = buildPrisma()) => {
  const app = new Hono<{
    Bindings: WorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();
  app.use('/auth/*', async (c, next) => {
    c.set('prisma', prisma);
    await next();
  });
  app.route('/auth', authRoutes);
  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json({ statusCode: err.status, message: err.message, error: 'Error' }, err.status);
    }
    return c.json(
      {
        statusCode: 'status' in err ? err.status : 500,
        message: err.message,
        error: 'status' in err && err.status === 401 ? 'Unauthorized' : 'Error',
      },
      'status' in err ? err.status : 500,
    );
  });
  return app;
};

const makeService = () => ({
  register: jest.fn(async () => ({
    tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    user: { id: 'user-1', email: 'reader@example.com' },
  })),
  refresh: jest.fn(async () => ({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' })),
  getCurrentUser: jest.fn(async () => ({ id: 'user-1', email: 'reader@example.com' })),
  forgotPassword: jest.fn(async () => undefined),
  resetPassword: jest.fn(async () => undefined),
});

describe('Worker auth route contracts', () => {
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    mockedMakeAuthService.mockReturnValue(service as unknown as ReturnType<typeof makeAuthService>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('POST /auth/register returns 201 with user body and auth cookies', async () => {
    const res = await buildApp().request(
      '/auth/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com', password: 'password123' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({ user: { id: 'user-1', email: 'reader@example.com' } });
    expect(service.register).toHaveBeenCalledWith('reader@example.com', 'password123');
    const cookies = splitSetCookieHeader(res.headers.get('set-cookie'));
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${COOKIE_ACCESS}=access-token`),
        expect.stringContaining(`${COOKIE_REFRESH}=refresh-token`),
      ]),
    );
  });

  it('POST /auth/refresh returns 200, refreshed body, and replaced auth cookies', async () => {
    const res = await buildApp().request(
      '/auth/refresh',
      { method: 'POST', headers: { cookie: `${COOKIE_REFRESH}=refresh-cookie` } },
      env,
    );

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ refreshed: true });
    expect(service.refresh).toHaveBeenCalledWith('refresh-cookie');
    const cookies = splitSetCookieHeader(res.headers.get('set-cookie'));
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${COOKIE_ACCESS}=fresh-access`),
        expect.stringContaining(`${COOKIE_REFRESH}=fresh-refresh`),
      ]),
    );
  });

  it('POST /auth/refresh returns 401 when the refresh cookie is missing', async () => {
    const res = await buildApp().request('/auth/refresh', { method: 'POST' }, env);

    expect(res.status).toBe(401);
    expect(await json(res)).toMatchObject({
      statusCode: 401,
      message: 'Missing refresh token',
      error: 'Unauthorized',
    });
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it('POST /auth/logout returns 200 ok and clears auth cookies', async () => {
    const res = await buildApp().request('/auth/logout', { method: 'POST' }, env);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
    const cookies = splitSetCookieHeader(res.headers.get('set-cookie'));
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${COOKIE_ACCESS}=;`),
        expect.stringContaining(`${COOKIE_REFRESH}=;`),
      ]),
    );
  });

  it('GET /auth/me returns 200 with the current user for a valid access bearer', async () => {
    const token = await new JoseJwtClient(env.JWT_SECRET ?? '').signAsync(
      { sub: 'user-1', type: 'access' },
      { expiresIn: '15m' },
    );

    const res = await buildApp().request(
      '/auth/me',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      env,
    );

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ user: { id: 'user-1', email: 'reader@example.com' } });
    expect(service.getCurrentUser).toHaveBeenCalledWith('user-1');
  });

  it('POST /auth/forgot-password returns 204 and an empty body', async () => {
    const res = await buildApp().request(
      '/auth/forgot-password',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com' }),
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(service.forgotPassword).toHaveBeenCalledWith('reader@example.com');
  });

  it('POST /auth/reset-password returns 204 and an empty body', async () => {
    const res = await buildApp().request(
      '/auth/reset-password',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'reset-token', password: 'newpass123' }),
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(service.resetPassword).toHaveBeenCalledWith('reset-token', 'newpass123');
  });
});
