import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

import {
  ACCESS_TOKEN_TTL,
  type AuthUser,
  COIN_TXN_TYPE_SIGNUP,
  type JwtPayload,
  REFRESH_TOKEN_TTL,
  RESET_TOKEN_TTL,
  SIGNUP_BONUS_COINS,
  SUBSCRIPTION_ACTIVE_STATUSES,
} from './auth.constants';
import { AuthError } from './auth.errors';
import type { FbCustomData, FbUserData } from '../fb-capi/fb-capi.types';
import type { GoogleIdVerifier } from './google-id-verifier';
import type { JoseJwtClient } from './jose-jwt.client';

// Structural deps: AuthService consumes only the methods listed below from
// each collaborator. The Nest stack passes real `@Injectable` class instances
// (EmailService, FbCapiService, StripeClient); the Cloudflare Worker passes
// plain-class equivalents from `apps/api/src/worker/services/*`. Declaring
// the surface here means importing the Nest classes' types is unnecessary,
// which would otherwise pull `@nestjs/common` (incompatible with Workers).
export type AuthEmailClient = {
  sendWelcomeEmail(to: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
};

export type AuthFbCapiClient = {
  sendEvent(
    eventName: string,
    eventId: string,
    userData: FbUserData,
    customData?: FbCustomData,
    userId?: string,
  ): Promise<void>;
};

// Slim Stripe surface — only the `subscriptions.cancel` path AuthService
// uses via deleteAccount. The Nest provider's full LazyStripe satisfies
// this; the Worker's stub throws on `get()` because deleteAccount is not
// yet wired into the Hono routes (Task 13).
export type AuthStripeClient = {
  get(): {
    subscriptions: {
      cancel(id: string): Promise<unknown>;
    };
  };
};

export type TokenPair = { accessToken: string; refreshToken: string };
export type AuthResult = { user: AuthUser; tokens: TokenPair };
export type GoogleAuthResult = AuthResult & { isNewUser: boolean; created: boolean };
export type AuthServiceDeps = {
  prisma: PrismaClient;
  jwt: JoseJwtClient;
  refreshJwt: JoseJwtClient;
  resetJwt: JoseJwtClient;
  email: AuthEmailClient;
  googleVerifier: GoogleIdVerifier;
  stripe: AuthStripeClient;
  fbCapi: AuthFbCapiClient;
};

const BCRYPT_COST = 12;

export class AuthService {
  private readonly logger = {
    error: (message: string, error?: unknown): void => {
      console.error(`[AuthService] ${message}`, error);
    },
  };

  constructor(private readonly deps: AuthServiceDeps) {}

  async register(
    email: string,
    password: string,
    opts: {
      fbConsent?: boolean;
      fbUserData?: Omit<FbUserData, 'email'>;
      fbEventId?: string;
    } = {},
  ): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.deps.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw AuthError.conflict('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const created = await this.deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          coinBalance: SIGNUP_BONUS_COINS,
        },
      });
      await tx.coinTransaction.create({
        data: {
          userId: user.id,
          amount: SIGNUP_BONUS_COINS,
          type: COIN_TXN_TYPE_SIGNUP,
          balanceAfter: SIGNUP_BONUS_COINS,
        },
      });
      return user;
    });

    void this.deps.email
      .sendWelcomeEmail(created.email)
      .catch((err) => this.logger.error('Welcome email failed', err as Error));
    if (opts.fbConsent === true) {
      void this.deps.fbCapi
        .sendEvent(
          'CompleteRegistration',
          opts.fbEventId ?? randomUUID(),
          { ...opts.fbUserData, email: created.email },
          undefined,
          created.id,
        )
        .catch((err) => this.logger.error('CompleteRegistration CAPI failed', err as Error));
    }

    const tokens = await this.issueTokens(created.id, created.email);
    return {
      user: this.toAuthUser(created, false),
      tokens,
    };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.deps.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || user.deletedAt || user.bannedAt || !user.passwordHash) {
      throw AuthError.unauthorized('Invalid email or password');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw AuthError.unauthorized('Invalid email or password');
    }
    const hasActiveSubscription = await this.checkActiveSubscription(user.id);
    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: this.toAuthUser(user, hasActiveSubscription),
      tokens,
    };
  }

  async loginWithGoogle(
    idToken: string,
    opts: {
      fbConsent?: boolean;
      fbUserData?: Omit<FbUserData, 'email'>;
      fbEventId?: string;
    } = {},
  ): Promise<GoogleAuthResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw AuthError.unauthorized('Google sign-in is not configured');
    }
    let payload: { sub?: string; email?: string; email_verified?: boolean };
    try {
      const ticket = await this.deps.googleVerifier.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw AuthError.unauthorized('Invalid Google token');
    }
    const googleId = payload.sub;
    const emailRaw = payload.email;
    if (!googleId || !emailRaw || !payload.email_verified) {
      throw AuthError.unauthorized('Google account is not verified');
    }
    const email = emailRaw.trim().toLowerCase();

    const existingByGoogle = await this.deps.prisma.user.findUnique({
      where: { googleId },
    });
    if (existingByGoogle && !existingByGoogle.deletedAt && !existingByGoogle.bannedAt) {
      const hasSub = await this.checkActiveSubscription(existingByGoogle.id);
      const tokens = await this.issueTokens(existingByGoogle.id, existingByGoogle.email);
      return {
        user: this.toAuthUser(existingByGoogle, hasSub),
        tokens,
        isNewUser: false,
        created: false,
      };
    }

    const existingByEmail = await this.deps.prisma.user.findUnique({
      where: { email },
    });
    if (existingByEmail && !existingByEmail.deletedAt && !existingByEmail.bannedAt) {
      const linked = await this.deps.prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId, emailVerified: true },
      });
      const hasSub = await this.checkActiveSubscription(linked.id);
      const tokens = await this.issueTokens(linked.id, linked.email);
      return {
        user: this.toAuthUser(linked, hasSub),
        tokens,
        isNewUser: false,
        created: false,
      };
    }

    const created = await this.deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email,
          googleId,
          emailVerified: true,
          coinBalance: SIGNUP_BONUS_COINS,
        },
      });
      await tx.coinTransaction.create({
        data: {
          userId: user.id,
          amount: SIGNUP_BONUS_COINS,
          type: COIN_TXN_TYPE_SIGNUP,
          balanceAfter: SIGNUP_BONUS_COINS,
        },
      });
      return user;
    });
    void this.deps.email
      .sendWelcomeEmail(created.email)
      .catch((err) => this.logger.error('Welcome email failed', err as Error));
    if (opts.fbConsent === true) {
      void this.deps.fbCapi
        .sendEvent(
          'CompleteRegistration',
          opts.fbEventId ?? randomUUID(),
          { ...opts.fbUserData, email: created.email },
          undefined,
          created.id,
        )
        .catch((err) => this.logger.error('CompleteRegistration CAPI failed', err as Error));
    }

    const tokens = await this.issueTokens(created.id, created.email);
    return {
      user: this.toAuthUser(created, false),
      tokens,
      isNewUser: true,
      created: true,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.deps.refreshJwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw AuthError.unauthorized('Invalid refresh token');
    }
    if (payload.type !== 'refresh' || !payload.sub) {
      throw AuthError.unauthorized('Invalid refresh token');
    }
    const user = await this.deps.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt || user.bannedAt) {
      throw AuthError.unauthorized('Invalid refresh token');
    }
    return this.issueTokens(user.id, user.email);
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.deps.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.deletedAt || user.bannedAt) {
      throw AuthError.unauthorized();
    }
    const hasActiveSubscription = await this.checkActiveSubscription(user.id);
    return this.toAuthUser(user, hasActiveSubscription);
  }

  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.deps.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, passwordHash: true },
    });
    if (!user || user.deletedAt) {
      return;
    }
    if (user.passwordHash) {
      if (!password || password.length < 8) {
        throw AuthError.unauthorized('Invalid password');
      }
      const passwordOk = await bcrypt.compare(password, user.passwordHash);
      if (!passwordOk) {
        throw AuthError.unauthorized('Invalid password');
      }
    }
    const activeSubs = await this.deps.prisma.subscription.findMany({
      where: { userId, status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] } },
      select: { stripeSubscriptionId: true },
    });
    if (activeSubs.length > 0) {
      let stripe: ReturnType<AuthStripeClient['get']> | null = null;
      try {
        stripe = this.deps.stripe.get();
      } catch (err) {
        this.logger.error(
          `Failed to initialize Stripe while deleting user ${userId}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw AuthError.internal(
          'Failed to cancel active subscription. Please try again or contact support.',
        );
      }
      for (const sub of activeSubs) {
        try {
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (err) {
          const stripeError = err as { code?: string; type?: string };
          if (
            stripeError.code === 'resource_missing' ||
            stripeError.code === 'no_such_subscription' ||
            stripeError.code === 'subscription_already_canceled' ||
            stripeError.type === 'StripeInvalidRequestError'
          ) {
            continue;
          }
          this.logger.error(
            `Failed to cancel subscription ${sub.stripeSubscriptionId}`,
            err instanceof Error ? err.stack : String(err),
          );
          throw AuthError.internal(
            'Failed to cancel active subscription. Please try again or contact support.',
          );
        }
      }
    }
    await this.deps.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.deps.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    // Silent on missing user — do not reveal account existence.
    if (!user || user.deletedAt) {
      return;
    }
    const token = await this.deps.resetJwt.signAsync(
      { sub: user.id, type: 'reset' } satisfies JwtPayload,
      {
        expiresIn: RESET_TOKEN_TTL,
      },
    );
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    void this.deps.email
      .sendPasswordResetEmail(user.email, resetUrl)
      .catch((err) => this.logger.error('Reset email failed', err as Error));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = await this.deps.resetJwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw AuthError.badRequest('Reset link is invalid or expired');
    }
    if (payload.type !== 'reset' || !payload.sub) {
      throw AuthError.badRequest('Reset link is invalid or expired');
    }
    const user = await this.deps.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt) {
      throw AuthError.badRequest('Reset link is invalid or expired');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.deps.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessPayload: JwtPayload = { sub: userId, email, type: 'access' };
    const refreshPayload: JwtPayload = { sub: userId, type: 'refresh' };
    const [accessToken, refreshToken] = await Promise.all([
      this.deps.jwt.signAsync(accessPayload, {
        expiresIn: ACCESS_TOKEN_TTL,
      }),
      this.deps.refreshJwt.signAsync(refreshPayload, {
        expiresIn: REFRESH_TOKEN_TTL,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async checkActiveSubscription(userId: string): Promise<boolean> {
    const sub = await this.deps.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] },
        currentPeriodEnd: { gt: new Date() },
      },
      select: { id: true },
    });
    return sub !== null;
  }

  private toAuthUser(
    user: {
      id: string;
      email: string;
      coinBalance: number;
      passwordHash: string | null;
      isAdmin: boolean;
      bannedAt: Date | null;
    },
    hasActiveSubscription: boolean,
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      coinBalance: user.coinBalance,
      hasPassword: user.passwordHash != null,
      hasActiveSubscription,
      isAdmin: user.isAdmin,
      bannedAt: user.bannedAt?.toISOString() ?? null,
    };
  }
}
