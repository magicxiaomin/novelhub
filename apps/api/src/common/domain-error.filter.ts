import { ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { DomainError } from './domain.errors';

const STATUS_TEXT: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.PAYMENT_REQUIRED]: 'Payment Required',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Translates a `DomainError` thrown by any runtime-agnostic service into the
 * matching HTTP response. Registered globally in `main.ts` so every
 * controller benefits without per-controller `@UseFilters` annotations.
 *
 * Writes the response directly via `ArgumentsHost` rather than rethrowing
 * a Nest `HttpException` — rethrowing from a filter registered globally
 * does not re-enter the filter chain and crashes the Node process. The
 * shape `{statusCode, message, error}` mirrors Nest's default
 * HttpException JSON envelope so existing frontend error handling keeps
 * working unchanged.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    res.status(exception.status).json({
      statusCode: exception.status,
      message: exception.message,
      error: STATUS_TEXT[exception.status] ?? 'Error',
      ...(exception.context ?? {}),
    });
  }
}
