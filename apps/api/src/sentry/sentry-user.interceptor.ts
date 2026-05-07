import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

type RequestUser = {
  id: string;
};

type RequestWithOptionalUser = Request & {
  user?: RequestUser;
};

@Injectable()
export class SentryUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.SENTRY_DSN && context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<RequestWithOptionalUser>();
      Sentry.setUser(request.user ? { id: request.user.id } : null);
    }

    return next.handle();
  }
}
