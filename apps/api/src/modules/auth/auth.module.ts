import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { PrismaProvider } from './providers/prisma.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    JwtStrategy,
    JwtAuthGuard,
    OptionalAuthGuard,
    PrismaProvider,
    GoogleOAuthProvider,
  ],
  exports: [AuthService, JwtAuthGuard, OptionalAuthGuard, PrismaProvider],
})
export class AuthModule {}
