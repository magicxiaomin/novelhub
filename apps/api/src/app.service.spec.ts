import type { PrismaClient } from '@prisma/client';

import { AppService } from './app.service';

const buildService = (
  $queryRaw: jest.Mock = jest.fn().mockResolvedValue([{ ok: 1 }]),
): AppService => {
  const prisma = { $queryRaw } as unknown as PrismaClient;
  return new AppService(prisma);
};

describe('AppService', () => {
  it('uses the shared workspace package for the application name', () => {
    expect(buildService().getApplicationName()).toBe('NovelHub');
  });

  it('reports status=ok and db=ok when the DB ping succeeds', async () => {
    const result = await buildService().getHealth();
    expect(result).toMatchObject({
      app: 'NovelHub',
      status: 'ok',
      db: 'ok',
    });
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof result.timestamp).toBe('string');
  });

  it('reports status=degraded and db=fail when the DB ping throws', async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('connection refused'));
    const result = await buildService(queryRaw).getHealth();
    expect(result).toMatchObject({
      app: 'NovelHub',
      status: 'degraded',
      db: 'fail',
    });
  });
});
