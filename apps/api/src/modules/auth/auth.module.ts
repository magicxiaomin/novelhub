import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import type { PrismaClient } from '@prisma/client';

import { AuthController } from './auth.controller';
import { AuthService, type AuthServiceDeps } from './auth.service';
import { EmailService } from './email.service';
import { createGoogleIdVerifier, type GoogleIdVerifier } from './google-id-verifier';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JoseJwtClient } from './jose-jwt.client';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { LazyStripe, type StripeClient } from '../payments/stripe.client';
import { PrismaProvider } from './providers/prisma.provider';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GOOGLE_OAUTH_CLIENT, PRISMA } from './auth.constants';
import { FbCapiService } from '../fb-capi/fb-capi.service';
import { STRIPE_CLIENT } from '../payments/stripe.constants';

const getJwtSecret = (): string => process.env.JWT_SECRET ?? 'dev-secret-change-me';
const getRefreshSecret = (): string =>
  process.env.JWT_REFRESH_SECRET ?? `${getJwtSecret()}-refresh`;
const getResetSecret = (): string => process.env.JWT_RESET_SECRET ?? `${getJwtSecret()}-reset`;

// Keep `GOOGLE_OAUTH_CLIENT` as the DI token name for backwards compatibility
// with the existing e2e tests that call `.overrideProvider(GOOGLE_OAUTH_CLIENT)`.
// The value is now a `GoogleIdVerifier` (jose-JWKS-backed) instead of the old
// `google-auth-library.OAuth2Client`, but the verifyIdToken shape is identical
// so the override stubs continue to work unchanged.
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    {
      provide: GOOGLE_OAUTH_CLIENT,
      useFactory: (): GoogleIdVerifier => createGoogleIdVerifier(),
    },
    {
      provide: AuthService,
      useFactory: (
        prisma: PrismaClient,
        email: EmailService,
        fbCapi: FbCapiService,
        stripe: StripeClient,
        googleVerifier: GoogleIdVerifier,
      ): AuthService => {
        const deps: AuthServiceDeps = {
          prisma,
          jwt: new JoseJwtClient(getJwtSecret()),
          refreshJwt: new JoseJwtClient(getRefreshSecret()),
          resetJwt: new JoseJwtClient(getResetSecret()),
          email,
          googleVerifier,
          stripe,
          fbCapi,
        };
        return new AuthService(deps);
      },
      inject: [PRISMA, EmailService, FbCapiService, STRIPE_CLIENT, GOOGLE_OAUTH_CLIENT],
    },
    EmailService,
    JwtStrategy,
    JwtAuthGuard,
    OptionalAuthGuard,
    PrismaProvider,
    {
      provide: STRIPE_CLIENT,
      useFactory: (): LazyStripe => new LazyStripe(process.env.STRIPE_SECRET_KEY),
    },
  ],
  exports: [AuthService, JwtAuthGuard, OptionalAuthGuard, PrismaProvider],
})
export class AuthModule {}
