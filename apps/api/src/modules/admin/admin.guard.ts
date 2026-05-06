import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

import { PRISMA } from '../auth/auth.constants';

/**
 * Verifies that the request carries a valid JWT (per JwtAuthGuard) AND
 * that the user row has `isAdmin: true`. Throws 401 if no user, 403 if not admin.
 *
 * Pair this with `JwtAuthGuard` so the strategy populates `req.user` first:
 *   `@UseGuards(JwtAuthGuard, AdminGuard)`
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    if (!req.user) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, isAdmin: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
