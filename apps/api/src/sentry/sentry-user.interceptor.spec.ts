import type { CallHandler, ExecutionContext } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { of } from 'rxjs';

import { SentryUserInterceptor } from './sentry-user.interceptor';

const isolationScopeSetUser = jest.fn();

jest.mock('@sentry/node', () => ({
  getIsolationScope: jest.fn(() => ({ setUser: isolationScopeSetUser })),
}));

const getIsolationScope = jest.mocked(Sentry.getIsolationScope);

describe('SentryUserInterceptor', () => {
  const originalSentryDsn = process.env.SENTRY_DSN;
  const next: CallHandler = {
    handle: jest.fn(() => of(null)),
  };

  beforeEach(() => {
    process.env.SENTRY_DSN = 'https://sentry.example/1';
    isolationScopeSetUser.mockClear();
    getIsolationScope.mockClear();
    jest.mocked(next.handle).mockClear();
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalSentryDsn;
  });

  const createContext = (user?: { id: string }): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('writes the user id to the per-request isolation scope when request.user exists', () => {
    new SentryUserInterceptor().intercept(createContext({ id: 'user-1' }), next);

    expect(getIsolationScope).toHaveBeenCalledTimes(1);
    expect(isolationScopeSetUser).toHaveBeenCalledWith({ id: 'user-1' });
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('clears the isolation-scope user when request.user is falsy', () => {
    new SentryUserInterceptor().intercept(createContext(), next);

    expect(getIsolationScope).toHaveBeenCalledTimes(1);
    expect(isolationScopeSetUser).toHaveBeenCalledWith(null);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('does not touch any Sentry scope when SENTRY_DSN is unset', () => {
    process.env.SENTRY_DSN = '';
    new SentryUserInterceptor().intercept(createContext({ id: 'user-1' }), next);

    expect(getIsolationScope).not.toHaveBeenCalled();
    expect(isolationScopeSetUser).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});
