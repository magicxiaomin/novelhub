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
import {
  ApiCookieAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ListProgressDto } from './dto/list-progress.dto';
import { ProgressListItemDto } from './dto/progress-list-item.dto';
import { ProgressResponseDto } from './dto/progress-response.dto';
import { SaveProgressDto } from './dto/save-progress.dto';
import {
  ReadingProgressService,
  type ProgressListItem,
  type ProgressResponse,
} from './reading-progress.service';

@ApiTags('reading-progress')
@ApiCookieAuth()
@ApiExtraModels(ProgressResponseDto, ProgressListItemDto)
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
  @ApiOkResponse({
    description:
      'When `bookId` or `chapterId` is provided: a single matching progress row, or `null` if none exists. Otherwise: an array of the 10 most recent Continue Reading entries.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProgressResponseDto) },
        { type: 'null' },
        { type: 'array', items: { $ref: getSchemaPath(ProgressListItemDto) } },
      ],
    },
  })
  get(
    @CurrentUser() user: { id: string } | null,
    @Query() query: ListProgressDto,
  ): Promise<ProgressResponse | ProgressListItem[] | null> {
    if (!user) throw new UnauthorizedException();
    if (query.bookId || query.chapterId) return this.progress.findOne(user.id, query);
    return this.progress.listRecent(user.id, 10);
  }
}
