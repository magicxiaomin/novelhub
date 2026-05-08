import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { type AuthUser, COOKIE_REFRESH } from './auth.constants';
import { AuthErrorFilter } from './auth-error.filter';
import { AuthService } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { CurrentUser } from './decorators/current-user.decorator';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { FbCapiService } from '../fb-capi/fb-capi.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type AuthResponse = { user: AuthUser };
type GoogleAuthResponse = AuthResponse & { isNewUser: boolean; created: boolean };

@ApiTags('auth')
@Controller('auth')
@UseFilters(AuthErrorFilter)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly fbCapi: FbCapiService,
  ) {}

  @Post('register')
  // Global throttling is 60/min; registration gets a tighter public-endpoint cap
  // because each successful call can fan out to email and FB CAPI providers.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user with email + password' })
  @ApiBody({ type: RegisterDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const fbConsent = this.fbCapi.shouldSendForRequest(req);
    const result = await this.authService.register(dto.email, dto.password, {
      fbConsent,
      fbUserData: fbConsent ? this.fbCapi.extractFbUserData(req) : undefined,
      fbEventId: dto.fbEventId,
    });
    setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email + password' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto.email, dto.password);
    setAuthCookies(res, result.tokens);
    return { user: result.user };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in or sign up via Google ID token' })
  @ApiBody({ type: GoogleAuthDto })
  async google(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleAuthResponse> {
    const fbConsent = this.fbCapi.shouldSendForRequest(req);
    const result = await this.authService.loginWithGoogle(dto.idToken, {
      fbConsent,
      fbUserData: fbConsent ? this.fbCapi.extractFbUserData(req) : undefined,
      fbEventId: dto.fbEventId,
    });
    setAuthCookies(res, result.tokens);
    return { user: result.user, isNewUser: result.isNewUser, created: result.created };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT cookies using the refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ refreshed: true }> {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_REFRESH];
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokens = await this.authService.refresh(token);
    setAuthCookies(res, tokens);
    return { refreshed: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear auth cookies' })
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    clearAuthCookies(res);
    return { ok: true };
  }

  @Delete('account')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Soft-delete the current account; requires password confirmation' })
  @ApiBody({ type: DeleteAccountDto })
  async deleteAccount(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    if (!user) {
      throw new UnauthorizedException();
    }
    await this.authService.deleteAccount(user.id, dto.password);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({ description: 'Returns the user identity + balance' })
  async me(@CurrentUser() user: { id: string } | null): Promise<AuthResponse> {
    if (!user) {
      throw new UnauthorizedException();
    }
    const fresh = await this.authService.getCurrentUser(user.id);
    return { user: fresh };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Send a password reset email if the address is registered',
  })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.password);
  }
}
