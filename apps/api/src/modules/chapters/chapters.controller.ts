import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';

import type { ChapterReadResponse } from './chapters.types';
import { ChaptersService } from './chapters.service';

@ApiTags('chapters')
@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chapters: ChaptersService) {}

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary: 'Read a single chapter; returns paywall info instead of content when locked',
  })
  @ApiOkResponse({ description: 'Chapter content or paywall envelope' })
  read(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: { id: string } | null,
  ): Promise<ChapterReadResponse> {
    return this.chapters.readChapter(id, user?.id ?? null);
  }
}
