import { Hono } from 'hono';

import { COOKIE_ACCESS, COOKIE_REFRESH } from '../../modules/auth/auth.constants';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeAuthService, type WorkerEnv } from '../services/auth-factory';
import { authRoutes } from './auth';

jest.mock('../services/auth-factory', () => ({
  makeAuthService: jest.fn(),
}));

const mockedMakeAuthService = jest.mocked(makeAuthService);

const splitSetCookieHeader = (header: string | null): string[] => {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,]+=)/).map((part) => part.trim());
};

const buildApp = () => {
  const app = new Hono<{
    Bindings: WorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();
  app.use('/auth/*', async (c, next) => {
    c.set('prisma', {} as PrismaVariables['prisma']);
    await next();
  });
  app.route('/auth', authRoutes);
  return app;
};

describe('Worker auth routes cookie domain', () => {
  beforeEach(() => {
    mockedMakeAuthService.mockReturnValue({
      login: jest.fn(async () => ({
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
        user: { id: 'user-id', email: 'reader@example.com' },
      })),
    } as unknown as ReturnType<typeof makeAuthService>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('passes AUTH_COOKIE_DOMAIN into Worker auth cookies when configured', async () => {
    const res = await buildApp().request(
      '/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com', password: 'password' }),
      },
      { AUTH_COOKIE_DOMAIN: '.dramavela.com', NODE_ENV: 'production' } as WorkerEnv,
    );

    expect(res.status).toBe(200);
    const cookies = splitSetCookieHeader(res.headers.get('set-cookie'));
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${COOKIE_ACCESS}=access-token`),
        expect.stringContaining(`${COOKIE_REFRESH}=refresh-token`),
      ]),
    );
    for (const cookie of cookies) {
      expect(cookie).toContain('Domain=.dramavela.com');
    }
  });

  it('omits Domain by default for Worker auth cookies', async () => {
    const res = await buildApp().request(
      '/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com', password: 'password' }),
      },
      { NODE_ENV: 'production' } as WorkerEnv,
    );

    expect(res.status).toBe(200);
    const cookies = splitSetCookieHeader(res.headers.get('set-cookie'));
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).not.toContain('Domain=');
    }
  });
});
