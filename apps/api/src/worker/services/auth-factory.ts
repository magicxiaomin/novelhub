/**
 * Builds an `AuthService` instance for the Cloudflare Worker runtime.
 * Mirrors the `useFactory` provider in apps/api/src/modules/auth/auth.module.ts
 * but uses Workers-compatible service replacements (EmailClient, the real
 * factory-shape FbCapiService, createWorkerPrisma) and a stub Stripe client
 * (the only Stripe-dependent AuthService method is `deleteAccount`, which is
 * not yet wired into the Hono routes — Task 3.1 ships register/login/refresh/
 * logout/me/forgot/reset).
 */
import type { PrismaClient } from '@prisma/client';

import {
  AuthService,
  type AuthServiceDeps,
  type AuthStripeClient,
} from '../../modules/auth/auth.service';
import { createGoogleIdVerifier } from '../../modules/auth/google-id-verifier';
import { JoseJwtClient } from '../../modules/auth/jose-jwt.client';
import { EmailClient } from './email-client';
import { makeFbCapiService } from './fb-capi-factory';

// Minimal R2 binding shape (avoid @cloudflare/workers-types runtime dep).
interface R2BucketBinding {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, body: string | ArrayBuffer | ReadableStream): Promise<unknown>;
}

export type WorkerEnv = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_RESET_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
  // Comma-separated extra origins permitted by Worker CORS, in addition to
  // NEXT_PUBLIC_APP_URL. Useful for staging/preview hosts (e.g. the
  // *.pages.dev preview URL each Pages deploy gets).
  CORS_EXTRA_ORIGINS?: string;
  // Set to 'true' when API and web app are on different registrable domains
  // (e.g. *.workers.dev + *.pages.dev on staging). Forces cookies to
  // SameSite=None + Secure so cross-site fetch+credentials work in browsers.
  COOKIE_CROSS_SITE?: string;
  // Optional shared auth cookie domain (for example `.dramavela.com`).
  AUTH_COOKIE_DOMAIN?: string;
  NODE_ENV?: string;
  // R2 (Task 4.2 — chapter content + signed URLs)
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY?: string;
  R2_SECRET_KEY?: string;
  R2_BUCKET?: string;
  // R2 binding declared in wrangler.toml; preferred for `getText` /
  // `uploadText` to skip the HTTP round-trip.
  BUCKET?: R2BucketBinding;
  // FB CAPI (Task 10 — async-hash + Sentry Cloudflare). Optional —
  // FbCapiService no-ops when these are unset.
  NEXT_PUBLIC_FB_PIXEL_ID?: string;
  FB_CAPI_ACCESS_TOKEN?: string;
  FB_TEST_EVENT_CODE?: string;
  // Sentry (Task 10). Read off env so `withSentry` can build per-request
  // options; middleware reads it via `setSentryUser` / `captureWorkerException`.
  SENTRY_DSN?: string;
};

export function makeAuthService(env: WorkerEnv, prisma: PrismaClient): AuthService {
  const jwtSecret = env.JWT_SECRET ?? 'dev-secret-change-me';
  const refreshSecret = env.JWT_REFRESH_SECRET ?? `${jwtSecret}-refresh`;
  const resetSecret = env.JWT_RESET_SECRET ?? `${jwtSecret}-reset`;

  // Stripe stub — Task 3.1's Hono routes do not call any AuthService method
  // that uses Stripe (deleteAccount is excluded). Throws if accidentally
  // invoked so a regression surfaces immediately.
  const stripeStub: AuthStripeClient = {
    get(): never {
      throw new Error('Stripe client not wired into Worker yet (Task 13 cutover)');
    },
  };

  const deps: AuthServiceDeps = {
    prisma,
    jwt: new JoseJwtClient(jwtSecret),
    refreshJwt: new JoseJwtClient(refreshSecret),
    resetJwt: new JoseJwtClient(resetSecret),
    email: new EmailClient(env.RESEND_API_KEY, env.EMAIL_FROM),
    googleVerifier: createGoogleIdVerifier(),
    stripe: stripeStub,
    fbCapi: makeFbCapiService(env, prisma),
  };

  return new AuthService(deps);
}
