import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { COOKIE_ACCESS, type JwtPayload, PRISMA } from '../auth.constants';

type JwtUser = { id: string; email?: string };

const cookieExtractor = (req: Request): string | null => {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[COOKIE_ACCESS] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, deletedAt: true, bannedAt: true },
    });
    if (!user || user.deletedAt || user.bannedAt) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email };
  }
}
