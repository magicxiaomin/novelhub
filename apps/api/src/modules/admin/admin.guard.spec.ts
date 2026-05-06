import { ForbiddenException, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { PRISMA } from '../auth/auth.constants';

import { AdminGuard } from './admin.guard';

const buildContext = (user: { id: string } | undefined): ExecutionContext => {
  const req = { user };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => () => undefined,
    }),
  } as unknown as ExecutionContext;
};

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let usersById: Map<string, { id: string; isAdmin: boolean; deletedAt: Date | null }>;

  beforeEach(async () => {
    usersById = new Map();
    const prisma = {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => usersById.get(where.id) ?? null,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminGuard, { provide: PRISMA, useValue: prisma }],
    }).compile();

    guard = module.get(AdminGuard);
  });

  it('throws Unauthorized when req.user is missing', async () => {
    await expect(guard.canActivate(buildContext(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized when user not found in DB', async () => {
    await expect(guard.canActivate(buildContext({ id: 'ghost' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized when user is soft-deleted', async () => {
    usersById.set('user-1', {
      id: 'user-1',
      isAdmin: true,
      deletedAt: new Date(),
    });
    await expect(guard.canActivate(buildContext({ id: 'user-1' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws Forbidden when user is not admin', async () => {
    usersById.set('user-2', {
      id: 'user-2',
      isAdmin: false,
      deletedAt: null,
    });
    await expect(guard.canActivate(buildContext({ id: 'user-2' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns true for an admin user', async () => {
    usersById.set('admin-1', {
      id: 'admin-1',
      isAdmin: true,
      deletedAt: null,
    });
    await expect(guard.canActivate(buildContext({ id: 'admin-1' }))).resolves.toBe(true);
  });
});
