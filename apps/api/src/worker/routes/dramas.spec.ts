import { Hono } from 'hono';

import { dramaProgressRoutes } from './drama-progress';
import { dramasRoutes } from './dramas';
import { episodesRoutes } from './episodes';

const makeApp = (env: Record<string, string | undefined> = {}) => {
  const app = new Hono<{
    Bindings: Record<string, string | undefined>;
    Variables: { prisma: unknown; user?: { id: string; email: string; isAdmin: boolean } };
  }>();
  app.use('*', async (c, next) => {
    c.set('prisma', { user: { findUnique: jest.fn() } });
    await next();
  });
  app.route('/drama-progress', dramaProgressRoutes);
  app.route('/dramas', dramasRoutes);
  app.route('/episodes', episodesRoutes);
  type AppRequestArgs = Parameters<typeof app.request>;
  return {
    request: (input: AppRequestArgs[0], requestInit?: AppRequestArgs[1]) =>
      app.request(input, requestInit, env),
  };
};

const expectDramaDeprecated = async (response: Response) => {
  expect(response.status).toBe(410);
  expect(response.headers.get('x-novelhub-deprecated')).toBe('drama');
  await expect(response.json()).resolves.toEqual({
    code: 'DRAMA_DEPRECATED',
    message: 'Short-drama endpoints are deprecated during the novels-only pivot.',
  });
};

describe('drama worker routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['GET', '/dramas'],
    ['GET', '/dramas/shadow-heiress'],
    ['GET', '/episodes/11111111-1111-4111-8111-111111111111/playback'],
    ['POST', '/episodes/11111111-1111-4111-8111-111111111111/unlock'],
    ['GET', '/drama-progress'],
    ['POST', '/drama-progress'],
  ])('hard-disables %s %s without creating the drama service', async (method, path) => {
    const response = await makeApp({ PRODUCT_MODE: 'mixed' }).request(path, { method });

    await expectDramaDeprecated(response);
  });
});
