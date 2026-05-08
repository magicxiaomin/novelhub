/**
 * Builds an `AuthService` instance for the Cloudflare Worker runtime.
 * Mirrors the `useFactory` provider in apps/api/src/modules/auth/auth.module.ts
 * but uses Workers-compatible service replacements (EmailClient, FbCapiClient,
 * createWorkerPrisma) and a stub Stripe client (the only Stripe-dependent
 * AuthService method is `deleteAccount`, which is not yet wired into the
 * Hono routes — Task 3.1 ships register/login/refresh/logout/me/forgot/reset).
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
import { FbCapiClient } from './fb-capi-client';

export type WorkerEnv = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_RESET_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NODE_ENV?: string;
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
    fbCapi: new FbCapiClient(),
  };

  return new AuthService(deps);
}
