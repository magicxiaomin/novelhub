import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { OAuth2Client } from 'google-auth-library';

import {
  ACCESS_TOKEN_TTL,
  type AuthUser,
  COIN_TXN_TYPE_SIGNUP,
  GOOGLE_OAUTH_CLIENT,
  type JwtPayload,
  PRISMA,
  REFRESH_TOKEN_TTL,
  RESET_TOKEN_TTL,
  SIGNUP_BONUS_COINS,
  SUBSCRIPTION_ACTIVE_STATUSES,
} from './auth.constants';
import { type StripeClient } from '../payments/stripe.client';
import { STRIPE_CLIENT } from '../payments/stripe.constants';
import { EmailService } from './email.service';

export type TokenPair = { accessToken: string; refreshToken: string };
export type AuthResult = { user: AuthUser; tokens: TokenPair };
export type GoogleAuthResult = AuthResult & { isNewUser: boolean };

const BCRYPT_COST = 12;

const getEnv = (key: string): string | undefined => process.env[key];

const getJwtSecret = (): string => getEnv('JWT_SECRET') ?? 'dev-secret-change-me';
const getRefreshSecret = (): string => getEnv('JWT_REFRESH_SECRET') ?? `${getJwtSecret()}-refresh`;
const getResetSecret = (): string => getEnv('JWT_RESET_SECRET') ?? `${getJwtSecret()}-reset`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    @Inject(GOOGLE_OAUTH_CLIENT) private readonly googleClient: OAuth2Client,
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
  ) {}

  async register(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    void this.email
      .sendWelcomeEmail(created.email)
      .catch((err) => this.logger.error('Welcome email failed', err as Error));

    const tokens = await this.issueTokens(created.id, created.email);
    return {
      user: this.toAuthUser(created, false),
      tokens,
    };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || user.deletedAt || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const hasActiveSubscription = await this.checkActiveSubscription(user.id);
    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: this.toAuthUser(user, hasActiveSubscription),
      tokens,
    };
  }

  async loginWithGoogle(idToken: string): Promise<GoogleAuthResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }
    let payload: { sub?: string; email?: string; email_verified?: boolean };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    const googleId = payload.sub;
    const emailRaw = payload.email;
    if (!googleId || !emailRaw || !payload.email_verified) {
      throw new UnauthorizedException('Google account is not verified');
    }
    const email = emailRaw.trim().toLowerCase();

    const existingByGoogle = await this.prisma.user.findUnique({
      where: { googleId },
    });
    if (existingByGoogle && !existingByGoogle.deletedAt) {
      const hasSub = await this.checkActiveSubscription(existingByGoogle.id);
      const tokens = await this.issueTokens(existingByGoogle.id, existingByGoogle.email);
      return {
        user: this.toAuthUser(existingByGoogle, hasSub),
        tokens,
        isNewUser: false,
      };
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingByEmail && !existingByEmail.deletedAt) {
      const linked = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId, emailVerified: true },
      });
      const hasSub = await this.checkActiveSubscription(linked.id);
      const tokens = await this.issueTokens(linked.id, linked.email);
      return {
        user: this.toAuthUser(linked, hasSub),
        tokens,
        isNewUser: false,
      };
    }

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    void this.email
      .sendWelcomeEmail(created.email)
      .catch((err) => this.logger.error('Welcome email failed', err as Error));

    const tokens = await this.issueTokens(created.id, created.email);
    return {
      user: this.toAuthUser(created, false),
      tokens,
      isNewUser: true,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens(user.id, user.email);
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    const hasActiveSubscription = await this.checkActiveSubscription(user.id);
    return this.toAuthUser(user, hasActiveSubscription);
  }

  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, passwordHash: true },
    });
    if (!user || user.deletedAt) {
      return;
    }
    if (user.passwordHash) {
      if (!password || password.length < 8) {
        throw new UnauthorizedException('Invalid password');
      }
      const passwordOk = await bcrypt.compare(password, user.passwordHash);
      if (!passwordOk) {
        throw new UnauthorizedException('Invalid password');
      }
    }
    const activeSubs = await this.prisma.subscription.findMany({
      where: { userId, status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES] } },
      select: { stripeSubscriptionId: true },
    });
    if (activeSubs.length > 0) {
      let stripe: ReturnType<StripeClient['get']> | null = null;
      try {
        stripe = this.stripe.get();
      } catch (err) {
        this.logger.error(
          `Failed to initialize Stripe while deleting user ${userId}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new InternalServerErrorException(
          'Failed to cancel active subscription. Please try again or contact support.',
        );
      }
      for (const sub of activeSubs) {
        try {
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (err) {
          this.logger.error(
            `Failed to cancel subscription ${sub.stripeSubscriptionId}`,
            err instanceof Error ? err.stack : String(err),
          );
          throw new InternalServerErrorException(
            'Failed to cancel active subscription. Please try again or contact support.',
          );
        }
      }
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    // Silent on missing user — do not reveal account existence.
    if (!user || user.deletedAt) {
      return;
    }
    const token = await this.jwt.signAsync({ sub: user.id, type: 'reset' } satisfies JwtPayload, {
      secret: getResetSecret(),
      expiresIn: RESET_TOKEN_TTL,
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    void this.email
      .sendPasswordResetEmail(user.email, resetUrl)
      .catch((err) => this.logger.error('Reset email failed', err as Error));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: getResetSecret(),
      });
    } catch {
      throw new BadRequestException('Reset link is invalid or expired');
    }
    if (payload.type !== 'reset' || !payload.sub) {
      throw new BadRequestException('Reset link is invalid or expired');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt) {
      throw new BadRequestException('Reset link is invalid or expired');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessPayload: JwtPayload = { sub: userId, email, type: 'access' };
    const refreshPayload: JwtPayload = { sub: userId, type: 'refresh' };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: getJwtSecret(),
        expiresIn: ACCESS_TOKEN_TTL,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: getRefreshSecret(),
        expiresIn: REFRESH_TOKEN_TTL,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async checkActiveSubscription(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findFirst({
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
    user: { id: string; email: string; coinBalance: number; passwordHash: string | null },
    hasActiveSubscription: boolean,
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      coinBalance: user.coinBalance,
      hasPassword: user.passwordHash != null,
      hasActiveSubscription,
    };
  }
}
