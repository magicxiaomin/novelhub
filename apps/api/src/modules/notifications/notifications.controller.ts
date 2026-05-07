import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AdminGuard } from '../admin/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { BroadcastDto } from './dto/broadcast.dto';
import { GrantBonusResponseDto } from './dto/grant-bonus-response.dto';
import { NotificationsService, type GrantBonusResult } from './notifications.service';

@ApiTags('notifications')
@ApiCookieAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('notifications/grant-bonus')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grant the one-time push permission coin bonus' })
  @ApiCreatedResponse({ type: GrantBonusResponseDto })
  grantBonus(@CurrentUser() user: { id: string } | null): Promise<GrantBonusResult> {
    if (!user) throw new UnauthorizedException();
    return this.notifications.grantBonus(user.id);
  }

  @Post('admin/push/broadcast')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an admin push broadcast via OneSignal' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { sent: { type: 'boolean' }, id: { type: 'string' } },
    },
  })
  broadcast(@Body() dto: BroadcastDto): Promise<{ sent: boolean; id?: string }> {
    return this.notifications.broadcast(dto);
  }
}
