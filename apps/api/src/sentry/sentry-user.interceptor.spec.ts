import type { CallHandler, ExecutionContext } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { of } from 'rxjs';

import { SentryUserInterceptor } from './sentry-user.interceptor';

jest.mock('@sentry/node', () => ({
  setUser: jest.fn(),
}));

const setUser = jest.mocked(Sentry.setUser);

describe('SentryUserInterceptor', () => {
  const originalSentryDsn = process.env.SENTRY_DSN;
  const next: CallHandler = {
    handle: jest.fn(() => of(null)),
  };

  beforeEach(() => {
    process.env.SENTRY_DSN = 'https://sentry.example/1';
    setUser.mockClear();
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

  it('sets the Sentry user id when request.user exists', () => {
    new SentryUserInterceptor().intercept(createContext({ id: 'user-1' }), next);

    expect(setUser).toHaveBeenCalledWith({ id: 'user-1' });
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('clears the Sentry user when request.user is falsy', () => {
    new SentryUserInterceptor().intercept(createContext(), next);

    expect(setUser).toHaveBeenCalledWith(null);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});
