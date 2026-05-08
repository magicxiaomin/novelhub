// Vercel Serverless adapter for the NestJS API. The application code in
// `src/` is unchanged; this file only wires the Nest container up to
// Vercel's `(req, res)` invocation model:
//
//   1. Bootstrap the Nest app once at module-eval time. Vercel keeps the
//      Lambda warm for ~5 min of idle, so subsequent requests reuse the
//      same Express adapter without re-running the DI graph.
//   2. Disable Vercel's default JSON body parser. NestFactory is created
//      with `rawBody: true` so Stripe webhook signature validation gets
//      the unmodified bytes. Letting Vercel parse the body first would
//      break that.
//   3. Forward each request to the underlying Express adapter via
//      `expressApp(req, res)`.
//
// Phase 1: this is the production deployment. `apps/api/Dockerfile` plus
// `src/main.ts` remain in place as the alternate entrypoint and can be
// deployed to a long-running container host (Railway, Fly, etc.) in
// Phase 2 without code changes.

import './../src/instrument';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookieParser from 'cookie-parser';
import { json, type NextFunction, type Request, type Response } from 'express';

import { AppModule } from './../src/app.module';
import { SentryExceptionFilter } from './../src/sentry/sentry-exception.filter';
import { SentryUserInterceptor } from './../src/sentry/sentry-user.interceptor';

let appPromise: Promise<NestExpressApplication> | null = null;

async function bootstrap(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Bulk chapter import sends up to 50 chapters x 200KB per chunk.
  app.use(
    '/admin/books/:bookId/chapters/bulk',
    (req: Request, res: Response, next: NextFunction) => {
      if (!req.headers.cookie?.includes('jwt=')) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      json({ limit: '10mb' })(req, res, next);
    },
  );

  // Trust the platform's first hop (Vercel) so req.ip is the client.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new SentryUserInterceptor());
  app.useGlobalFilters(new SentryExceptionFilter(app.getHttpAdapter()));

  const corsOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  app.enableCors({ origin: corsOrigin, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NovelHub API')
    .setDescription('NovelHub backend API')
    .setVersion('0.1.0')
    .addCookieAuth('jwt')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.init();
  return app;
}

// Disable Vercel's default body parser so Nest can read the raw bytes
// (Stripe webhook signature verification depends on this).
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!appPromise) appPromise = bootstrap();
  const app = await appPromise;
  const expressApp = app.getHttpAdapter().getInstance();

  // The vercel.json rewrite turns external `/<path>` into `/api/<path>` so the
  // request hits this catchall function. Nest's controllers are registered at
  // bare paths (e.g. `/health`, `/books`), so strip the prefix before passing
  // the request to Express.
  if (req.url?.startsWith('/api/')) req.url = req.url.slice(4);
  else if (req.url === '/api') req.url = '/';

  expressApp(req as unknown as Request, res as unknown as Response);
}
