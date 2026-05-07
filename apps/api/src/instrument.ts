// Sentry must be initialized BEFORE @nestjs/*, express, prisma, or any other
// module @sentry/node v10 auto-instruments. The SDK patches modules at
// require-time, so any imports above this file will run unpatched. Keep this
// file dependency-light and import it as the very first line of main.ts.
import { scrubSentryEvent } from '@novelhub/shared';
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
}
