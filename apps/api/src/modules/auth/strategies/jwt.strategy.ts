import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { COOKIE_ACCESS, type JwtPayload } from '../auth.constants';

type JwtUser = { id: string; email?: string };

const cookieExtractor = (req: Request): string | null => {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[COOKIE_ACCESS] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  validate(payload: JwtPayload): JwtUser {
    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, email: payload.email };
  }
}
