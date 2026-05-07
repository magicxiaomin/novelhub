import { UnauthorizedException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const makeStrategy = (
    user: { id: string; email: string; deletedAt: Date | null; bannedAt: Date | null } | null,
  ) => {
    const findUnique = jest.fn(async () => user);
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as PrismaClient;

    return { strategy: new JwtStrategy(prisma), findUnique };
  };

  it('validate: returns the current user for a valid access token payload', async () => {
    const { strategy, findUnique } = makeStrategy({
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
      bannedAt: null,
    });

    await expect(
      strategy.validate({ sub: 'user-1', email: 'stale@example.com', type: 'access' }),
    ).resolves.toEqual({ id: 'user-1', email: 'luna@example.com' });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, deletedAt: true, bannedAt: true },
    });
  });

  it('validate: rejects deleted users', async () => {
    const { strategy } = makeStrategy({
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: new Date(),
      bannedAt: null,
    });

    await expect(
      strategy.validate({ sub: 'user-1', email: 'luna@example.com', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validate: rejects banned users', async () => {
    const { strategy } = makeStrategy({
      id: 'user-1',
      email: 'luna@example.com',
      deletedAt: null,
      bannedAt: new Date(),
    });

    await expect(
      strategy.validate({ sub: 'user-1', email: 'luna@example.com', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validate: rejects non-access token payloads', async () => {
    const { strategy } = makeStrategy(null);

    await expect(strategy.validate({ sub: 'user-1', type: 'refresh' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
