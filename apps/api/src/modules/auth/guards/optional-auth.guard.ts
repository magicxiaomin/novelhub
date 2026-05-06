import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but doesn't 401 when the token is missing or invalid —
 * `req.user` is simply unset. Use this on endpoints that accept both guests
 * and authenticated users (free chapters, public listings).
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
