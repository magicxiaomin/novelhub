import { ArgumentsHost, Catch, HttpException, type HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  constructor(applicationRef: HttpServer) {
    super(applicationRef);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (process.env.SENTRY_DSN) {
      // Capture both unknown errors (programming bugs / unhandled rejections)
      // AND explicit 5xx HttpExceptions like InternalServerErrorException,
      // BadGatewayException, ServiceUnavailableException — these are the
      // production failures Ticket 14 actually wants in Sentry. 4xx are user
      // errors and stay out.
      const shouldCapture = !(exception instanceof HttpException) || exception.getStatus() >= 500;
      if (shouldCapture) {
        Sentry.captureException(exception);
      }
    }

    super.catch(exception, host);
  }
}
