import { Hono } from 'hono';

import type { PrismaVariables } from '../db/prisma';
import type { AuthVariables } from '../middleware/auth';
import type { WorkerEnv } from '../services/auth-factory';
import { dramaProgressRoutes } from './drama-progress';
import { dramasRoutes } from './dramas';
import { episodesRoutes } from './episodes';

// Contract tests focus on public route shape, not token parsing.
jest.mock('../middleware/auth', () => ({
  optionalAuth: jest.fn(async (_c, next) => next()),
  requireAuth: jest.fn(async (c, next) => {
    c.set('user', { id: 'user-1', email: 'reader@example.com', isAdmin: false });
    await next();
  }),
}));

const DRAMA_DEPRECATED_BODY = {
  code: 'DRAMA_DEPRECATED',
  message: 'Short-drama endpoints are deprecated during the novels-only pivot.',
} as const;

type CoveredDramaRoute = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
};

// Mirrors docs/pivot/quarantine-register.md and docs/pivot/drama-deprecation-contract.md.
const coveredDramaRoutes: CoveredDramaRoute[] = [
  { name: 'drama browse', method: 'GET', path: '/dramas' },
  { name: 'drama detail', method: 'GET', path: '/dramas/shadow-heiress' },
  {
    name: 'episode playback',
    method: 'GET',
    path: '/episodes/11111111-1111-4111-8111-111111111111/playback',
  },
  {
    name: 'episode unlock',
    method: 'POST',
    path: '/episodes/11111111-1111-4111-8111-111111111111/unlock',
  },
  { name: 'drama progress read', method: 'GET', path: '/drama-progress' },
  {
    name: 'drama progress write',
    method: 'POST',
    path: '/drama-progress',
    body: {
      episodeId: '11111111-1111-4111-8111-111111111111',
      positionSeconds: 42,
      durationSeconds: 60,
      completed: false,
    },
  },
];

const buildApp = (env: Partial<WorkerEnv> = {}) => {
  const app = new Hono<{
    Bindings: WorkerEnv;
    Variables: PrismaVariables & Partial<AuthVariables>;
  }>();
  app.use('*', async (c, next) => {
    c.set('prisma', {} as PrismaVariables['prisma']);
    await next();
  });
  app.route('/dramas', dramasRoutes);
  app.route('/episodes', episodesRoutes);
  app.route('/drama-progress', dramaProgressRoutes);

  type AppRequestArgs = Parameters<typeof app.request>;
  return {
    request: (input: AppRequestArgs[0], requestInit?: AppRequestArgs[1]) =>
      app.request(input, requestInit, env as WorkerEnv),
  };
};

const requestCoveredDramaRoute = (app: ReturnType<typeof buildApp>, route: CoveredDramaRoute) =>
  app.request(route.path, {
    method: route.method,
    ...(route.body
      ? {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(route.body),
        }
      : {}),
  });

const expectDramaDeprecated = async (response: Response) => {
  expect(response.status).toBe(410);
  expect(response.status).not.toBe(200);
  expect(response.status).not.toBe(201);
  expect(response.status >= 300 && response.status < 400).toBe(false);
  expect(response.headers.get('x-novelhub-deprecated')).toBe('drama');
  await expect(response.json()).resolves.toEqual(DRAMA_DEPRECATED_BODY);
};

describe('Worker drama route product-mode contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(coveredDramaRoutes)(
    'deprecates $name ($method $path) with the shared drama quarantine envelope',
    async (route) => {
      const app = buildApp();

      await expectDramaDeprecated(await requestCoveredDramaRoute(app, route));
    },
  );

  it('does not allow any covered drama route family to return success or redirects', async () => {
    const app = buildApp();

    const responses = await Promise.all(
      coveredDramaRoutes.map((route) => requestCoveredDramaRoute(app, route)),
    );

    expect(responses).toHaveLength(coveredDramaRoutes.length);
    for (const response of responses) {
      expect(response.status).not.toBe(200);
      expect(response.status).not.toBe(201);
      expect(response.status >= 300 && response.status < 400).toBe(false);
      expect(response.status).toBe(410);
    }
  });
});
