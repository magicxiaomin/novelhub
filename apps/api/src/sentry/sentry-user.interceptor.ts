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
      // Bind to the per-request isolation scope, not the global current scope.
      // @sentry/node v10 auto-isolation gives each HTTP request its own scope
      // today, but `Sentry.setUser` writes to the *current* scope which can
      // bleed across requests if async work escapes the request context.
      // `getIsolationScope()` is the documented per-request boundary.
      Sentry.getIsolationScope().setUser(request.user ? { id: request.user.id } : null);
    }

    return next.handle();
  }
}
