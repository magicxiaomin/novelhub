// Must be the FIRST import — Sentry's auto-instrumentation patches modules at
// require-time and has to load before any @nestjs/*, express, or prisma code.
import './instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, type NextFunction, type Request, type Response } from 'express';

import { AppModule } from './app.module';
import { SentryExceptionFilter } from './sentry/sentry-exception.filter';
import { SentryUserInterceptor } from './sentry/sentry-user.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  // Bulk chapter import sends up to 50 chapters x 200KB per chunk (~10MB).
  // Mount a wider JSON parser ONLY on that specific route — keep the global
  // default at Nest's 100KB to limit DoS surface on other endpoints.
  // Gate the wider parser behind an auth-cookie-presence check so anonymous
  // attackers can't burn CPU/memory parsing 10MB of garbage before the
  // AdminGuard fires.
  app.use(
    '/admin/books/:bookId/chapters/bulk',
    (req: Request, res: Response, next: NextFunction) => {
      // The auth cookie is `jwt=...` (apps/api/src/modules/auth/auth.constants.ts).
      if (!req.headers.cookie?.includes('jwt=')) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      json({ limit: '10mb' })(req, res, next);
    },
  );
  // Trust the first hop (Railway / Vercel / similar) so req.ip resolves to
  // the client address for FB CAPI attribution and rate-limit keys.
  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new SentryUserInterceptor());
  app.useGlobalFilters(new SentryExceptionFilter(app.getHttpAdapter()));

  const corsOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  app.enableCors({ origin: corsOrigin, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NovelHub API')
    .setDescription('API skeleton for NovelHub')
    .setVersion('0.1.0')
    .addCookieAuth('jwt')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
