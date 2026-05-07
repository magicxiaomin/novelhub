import { ArgumentsHost, HttpException, HttpStatus, type HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

import { SentryExceptionFilter } from './sentry-exception.filter';

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

const captureException = jest.mocked(Sentry.captureException);

describe('SentryExceptionFilter', () => {
  const originalSentryDsn = process.env.SENTRY_DSN;
  let superCatch: jest.SpyInstance<void, [unknown, ArgumentsHost]>;

  beforeEach(() => {
    captureException.mockClear();
    superCatch = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation();
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalSentryDsn;
    superCatch.mockRestore();
  });

  const createFilter = () => new SentryExceptionFilter({} as HttpServer);
  const host = {} as ArgumentsHost;

  it('does not capture 4xx HttpException errors (user errors)', () => {
    process.env.SENTRY_DSN = 'https://sentry.example/1';
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    createFilter().catch(exception, host);

    expect(captureException).not.toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalledWith(exception, host);
  });

  it('captures 5xx HttpException errors (server errors)', () => {
    process.env.SENTRY_DSN = 'https://sentry.example/1';
    const exception = new HttpException('Upstream failed', HttpStatus.INTERNAL_SERVER_ERROR);

    createFilter().catch(exception, host);

    expect(captureException).toHaveBeenCalledWith(exception);
    expect(superCatch).toHaveBeenCalledWith(exception, host);
  });

  it('captures non-HttpException errors when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = 'https://sentry.example/1';
    const exception = new Error('Unexpected failure');

    createFilter().catch(exception, host);

    expect(captureException).toHaveBeenCalledWith(exception);
    expect(superCatch).toHaveBeenCalledWith(exception, host);
  });

  it('does not capture non-HttpException errors when SENTRY_DSN is unset', () => {
    delete process.env.SENTRY_DSN;
    const exception = new Error('Unexpected failure');

    createFilter().catch(exception, host);

    expect(captureException).not.toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalledWith(exception, host);
  });

  it('always calls the base exception filter', () => {
    process.env.SENTRY_DSN = 'https://sentry.example/1';
    const exceptions = [
      new HttpException('Bad request', HttpStatus.BAD_REQUEST),
      new Error('Unexpected failure'),
      'string exception',
    ];

    for (const exception of exceptions) {
      createFilter().catch(exception, host);
    }

    expect(superCatch).toHaveBeenCalledTimes(exceptions.length);
  });
});
