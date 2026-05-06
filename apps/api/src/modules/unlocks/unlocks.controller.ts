import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ListUnlocksDto } from './dto/list-unlocks.dto';
import type { UnlockListItem, UnlockResponse } from './unlocks.constants';
import { UnlocksService } from './unlocks.service';

@ApiTags('unlocks')
@ApiCookieAuth()
@Controller('unlocks')
@UseGuards(JwtAuthGuard)
export class UnlocksController {
  constructor(private readonly unlocks: UnlocksService) {}

  @Post('chapter/:chapterId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Unlock a chapter. Idempotent — repeat calls return the existing unlock. 402 with paywall envelope on insufficient balance.',
  })
  unlock(
    @CurrentUser() user: { id: string } | null,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
  ): Promise<UnlockResponse> {
    if (!user) throw new UnauthorizedException();
    return this.unlocks.unlockChapter(user.id, chapterId);
  }

  @Get()
  @ApiOperation({ summary: 'List chapters the current user has unlocked' })
  @ApiOkResponse({ description: 'Paginated unlocks for the current user' })
  list(
    @CurrentUser() user: { id: string } | null,
    @Query() query: ListUnlocksDto,
  ): Promise<{
    items: UnlockListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (!user) throw new UnauthorizedException();
    return this.unlocks.list(user.id, query.page, query.limit);
  }
}
