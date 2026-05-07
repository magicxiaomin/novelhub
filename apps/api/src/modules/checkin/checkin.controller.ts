import {
  Controller,
  Get,
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

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CheckinService, type CheckinClaim, type CheckinStatus } from './checkin.service';
import { CheckinClaimResponseDto } from './dto/claim-response.dto';
import { CheckinStatusResponseDto } from './dto/status-response.dto';

@ApiTags('checkin')
@ApiCookieAuth()
@Controller('checkin')
@UseGuards(JwtAuthGuard)
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  @Get('status')
  @ApiOperation({ summary: 'Fetch the current user daily check-in status' })
  @ApiOkResponse({ type: CheckinStatusResponseDto })
  status(@CurrentUser() user: { id: string } | null): Promise<CheckinStatus> {
    if (!user) throw new UnauthorizedException();
    return this.checkin.getStatus(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Claim the current user daily check-in reward' })
  @ApiCreatedResponse({ type: CheckinClaimResponseDto })
  claim(@CurrentUser() user: { id: string } | null): Promise<CheckinClaim> {
    if (!user) throw new UnauthorizedException();
    return this.checkin.claim(user.id);
  }
}
