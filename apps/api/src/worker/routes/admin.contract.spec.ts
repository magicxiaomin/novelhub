import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { DomainError } from '../../common/domain.errors';
import { COOKIE_ACCESS, type JwtPayload } from '../../modules/auth/auth.constants';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import { makeAdminService, type AdminWorkerEnv } from '../services/admin-factory';
import { adminRoutes } from './admin';

jest.mock('../sentry', () => ({
  setSentryUser: jest.fn(),
}));

jest.mock('../services/admin-factory', () => ({
  makeAdminService: jest.fn(),
}));

const mockedMakeAdminService = jest.mocked(makeAdminService);

const jwtSecret = 'admin-contract-secret';
const adminId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const bookBody = {
  title: 'Contract Novel',
  author: 'Author Name',
  coverUrl: 'https://cdn.test/cover.jpg',
  description: 'A route contract fixture.',
  category: 'Fantasy',
};
const chapterBody = { title: 'Chapter 1', content: 'Once upon a time', isFree: true };
const updateChapterBody = { title: 'Updated Chapter', isFree: false, order: 2 };
const dashboard = { books: 2, users: 3, orders: 4 };
const listEnvelope = { items: [{ id: targetId }], total: 1, page: 1, limit: 20 };
const entityEnvelope = { id: targetId, title: 'Contract Novel' };
const mutationEnvelope = { ok: true, id: targetId };
const uploadEnvelope = { uploadUrl: 'https://r2.test/upload', key: 'covers/key.jpg' };

const makeToken = (payload: JwtPayload, secret = jwtSecret) =>
  new JoseJwtClient(secret).signAsync(payload, { expiresIn: '15m' });

const makeCookie = (token: string) => `${COOKIE_ACCESS}=${token}`;

const buildPrisma = (
  user: { id: string; email: string; isAdmin: boolean } | null = {
    id: adminId,
    email: 'admin@example.com',
    isAdmin: true,
  },
) =>
  ({
    user: {
      findUnique: jest.fn().mockResolvedValue(
        user
          ? {
              ...user,
              deletedAt: null,
              bannedAt: null,
            }
          : null,
      ),
    },
  }) as unknown as PrismaVariables['prisma'];

const buildApp = (prisma = buildPrisma()) => {
  const app = new Hono<{
    Bindings: AdminWorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();

  app.use('*', async (c, next) => {
    c.set('prisma', prisma);
    await next();
  });
  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        {
          statusCode: err.status,
          message: err.message,
          error: err.status === 400 ? 'Bad Request' : 'Error',
          ...(err.context ?? {}),
        },
        err.status,
      );
    }
    if (err instanceof HTTPException) {
      return c.json(
        {
          statusCode: err.status,
          message: err.message,
          error: err.status === 401 ? 'Unauthorized' : 'Error',
        },
        err.status,
      );
    }
    return c.json(
      { statusCode: 500, message: 'Internal Server Error', error: 'Internal Server Error' },
      500,
    );
  });
  app.route('/admin', adminRoutes);
  return app;
};

const env: AdminWorkerEnv = { JWT_SECRET: jwtSecret, R2_PUBLIC_HOST: 'https://cdn.test' };

describe('Worker admin route contracts', () => {
  const dashboardSummary = jest.fn();
  const listBooks = jest.fn();
  const getBook = jest.fn();
  const createBook = jest.fn();
  const updateBook = jest.fn();
  const softDeleteBook = jest.fn();
  const bulkImportChapters = jest.fn();
  const bulkCreateChapters = jest.fn();
  const listChapters = jest.fn();
  const getChapter = jest.fn();
  const updateChapter = jest.fn();
  const softDeleteChapter = jest.fn();
  const listUsers = jest.fn();
  const getUser = jest.fn();
  const banUser = jest.fn();
  const unbanUser = jest.fn();
  const listOrders = jest.fn();
  const coverUploadUrl = jest.fn();

  beforeEach(() => {
    dashboardSummary.mockResolvedValue(dashboard);
    listBooks.mockResolvedValue(listEnvelope);
    getBook.mockResolvedValue(entityEnvelope);
    createBook.mockResolvedValue(entityEnvelope);
    updateBook.mockResolvedValue(entityEnvelope);
    softDeleteBook.mockResolvedValue(mutationEnvelope);
    bulkImportChapters.mockResolvedValue(mutationEnvelope);
    bulkCreateChapters.mockResolvedValue(mutationEnvelope);
    listChapters.mockResolvedValue(listEnvelope);
    getChapter.mockResolvedValue(entityEnvelope);
    updateChapter.mockResolvedValue(entityEnvelope);
    softDeleteChapter.mockResolvedValue(mutationEnvelope);
    listUsers.mockResolvedValue(listEnvelope);
    getUser.mockResolvedValue({ id: targetId, email: 'reader@example.com' });
    banUser.mockResolvedValue(mutationEnvelope);
    unbanUser.mockResolvedValue(mutationEnvelope);
    listOrders.mockResolvedValue(listEnvelope);
    coverUploadUrl.mockResolvedValue(uploadEnvelope);
    mockedMakeAdminService.mockReturnValue({
      dashboardSummary,
      listBooks,
      getBook,
      createBook,
      updateBook,
      softDeleteBook,
      bulkImportChapters,
      bulkCreateChapters,
      listChapters,
      getChapter,
      updateChapter,
      softDeleteChapter,
      listUsers,
      getUser,
      banUser,
      unbanUser,
      listOrders,
      coverUploadUrl,
    } as unknown as ReturnType<typeof makeAdminService>);
  });

  afterEach(() => jest.clearAllMocks());

  const authHeaders = async (useBearer = false): Promise<Record<string, string>> => {
    const token = await makeToken({ sub: adminId, email: 'admin@example.com', type: 'access' });
    return useBearer ? { authorization: `Bearer ${token}` } : { cookie: makeCookie(token) };
  };

  it.each([
    ['GET', '/admin/dashboard/summary', undefined, dashboard, dashboardSummary],
    ['GET', '/admin/books?page=1&limit=20&search=novel', undefined, listEnvelope, listBooks],
    ['GET', `/admin/books/${targetId}`, undefined, entityEnvelope, getBook],
    ['POST', '/admin/books', bookBody, entityEnvelope, createBook],
    ['PUT', `/admin/books/${targetId}`, { title: 'Updated Title' }, entityEnvelope, updateBook],
    ['DELETE', `/admin/books/${targetId}`, undefined, mutationEnvelope, softDeleteBook],
    [
      'POST',
      `/admin/books/${targetId}/chapters/bulk`,
      { chapters: [chapterBody] },
      mutationEnvelope,
      bulkCreateChapters,
    ],
    [
      'GET',
      `/admin/chapters?page=1&limit=20&bookId=${targetId}`,
      undefined,
      listEnvelope,
      listChapters,
    ],
    ['GET', `/admin/chapters/${targetId}`, undefined, entityEnvelope, getChapter],
    ['PUT', `/admin/chapters/${targetId}`, updateChapterBody, entityEnvelope, updateChapter],
    ['DELETE', `/admin/chapters/${targetId}`, undefined, mutationEnvelope, softDeleteChapter],
    ['GET', '/admin/users?page=1&limit=20&search=reader', undefined, listEnvelope, listUsers],
    [
      'GET',
      `/admin/users/${targetId}`,
      undefined,
      { id: targetId, email: 'reader@example.com' },
      getUser,
    ],
    ['POST', `/admin/users/${targetId}/ban`, undefined, mutationEnvelope, banUser],
    ['POST', `/admin/users/${targetId}/unban`, undefined, mutationEnvelope, unbanUser],
    ['GET', '/admin/orders?page=1&limit=20&status=completed', undefined, listEnvelope, listOrders],
    [
      'POST',
      '/admin/uploads/cover-url',
      { contentType: 'image/jpeg' },
      uploadEnvelope,
      coverUploadUrl,
    ],
  ] as const)(
    'returns a mocked admin success envelope for %s %s',
    async (method, path, body, expected, serviceMethod) => {
      const app = buildApp();
      const headers = await authHeaders(method === 'GET');
      const response = await app.request(
        path,
        {
          method,
          headers: {
            ...headers,
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        env,
      );

      expect(response.status).toBe(
        method === 'POST' &&
          path !== `/admin/users/${targetId}/ban` &&
          path !== `/admin/users/${targetId}/unban`
          ? 201
          : 200,
      );
      expect(mockedMakeAdminService).toHaveBeenCalledTimes(1);
      expect(serviceMethod).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toEqual(expected);
    },
  );

  it('passes multipart chapter imports to the mocked admin service', async () => {
    const app = buildApp();
    const form = new FormData();
    form.set(
      'file',
      new Blob(['Chapter A\n---\nChapter B'], { type: 'text/plain' }),
      'chapters.txt',
    );
    form.set('delimiter', '---');
    form.set('replace', 'true');

    const response = await app.request(
      `/admin/books/${targetId}/chapters`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: form,
      },
      env,
    );

    expect(response.status).toBe(201);
    expect(mockedMakeAdminService).toHaveBeenCalledTimes(1);
    expect(bulkImportChapters).toHaveBeenCalledTimes(1);
    const [bookId, bytes, options] = bulkImportChapters.mock.calls[0] as [
      string,
      Uint8Array,
      unknown,
    ];
    expect(bookId).toBe(targetId);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(options).toEqual({ delimiter: '---', replace: true });
    await expect(response.json()).resolves.toEqual(mutationEnvelope);
  });

  it.each([
    ['missing JWT', undefined, buildPrisma()],
    [
      'bad signature',
      makeToken({ sub: adminId, email: 'admin@example.com', type: 'access' }, 'wrong-secret'),
      buildPrisma(),
    ],
  ])(
    'returns 401 for %s without constructing the admin service',
    async (_name, tokenOrPromise, prisma) => {
      const app = buildApp(prisma);
      const token = tokenOrPromise ? await tokenOrPromise : undefined;

      const response = await app.request(
        '/admin/dashboard/summary',
        token ? { headers: { cookie: makeCookie(token) } } : undefined,
        env,
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Unauthorized',
      });
      expect(mockedMakeAdminService).not.toHaveBeenCalled();
      expect(dashboardSummary).not.toHaveBeenCalled();
    },
  );

  it('returns 403 for an authenticated non-admin user without constructing the admin service', async () => {
    const app = buildApp(buildPrisma({ id: adminId, email: 'reader@example.com', isAdmin: false }));
    const token = await makeToken({ sub: adminId, email: 'reader@example.com', type: 'access' });

    const response = await app.request(
      '/admin/dashboard/summary',
      { headers: { cookie: makeCookie(token) } },
      env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 403,
      error: 'Error',
      message: 'Forbidden',
    });
    expect(mockedMakeAdminService).not.toHaveBeenCalled();
    expect(dashboardSummary).not.toHaveBeenCalled();
  });
});
