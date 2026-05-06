import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ListProgressDto } from './dto/list-progress.dto';
import { ProgressResponseDto } from './dto/progress-response.dto';
import { SaveProgressDto } from './dto/save-progress.dto';
import {
  ReadingProgressService,
  type ProgressListItem,
  type ProgressResponse,
} from './reading-progress.service';

@ApiTags('reading-progress')
@ApiCookieAuth()
@Controller('reading-progress')
@UseGuards(JwtAuthGuard)
export class ReadingProgressController {
  constructor(private readonly progress: ReadingProgressService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save current user reading progress for a chapter' })
  @ApiOkResponse({ type: ProgressResponseDto })
  save(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: SaveProgressDto,
  ): Promise<ProgressResponse> {
    if (!user) throw new UnauthorizedException();
    return this.progress.save(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Fetch current user reading progress or recent Continue Reading entries',
  })
  @ApiOkResponse({ description: 'A single row, null, or recent progress entries' })
  get(
    @CurrentUser() user: { id: string } | null,
    @Query() query: ListProgressDto,
  ): Promise<ProgressResponse | ProgressListItem[] | null> {
    if (!user) throw new UnauthorizedException();
    if (query.bookId || query.chapterId) return this.progress.findOne(user.id, query);
    return this.progress.listRecent(user.id, 10);
  }
}
