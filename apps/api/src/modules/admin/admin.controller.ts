import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CreateBookDto, UpdateBookDto } from './dto/book.dto';
import { BulkCreateChaptersDto, BulkImportOptionsDto, UpdateChapterDto } from './dto/chapter.dto';
import {
  CreateDramaDto,
  CreateEpisodeDto,
  UpdateDramaDto,
  UpdateEpisodeDto,
} from './dto/drama.dto';
import {
  AdminChapterListDto,
  AdminOrderListDto,
  AdminSearchDto,
  CoverUploadUrlDto,
} from './dto/query.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get admin dashboard summary' })
  dashboardSummary(): ReturnType<AdminService['dashboardSummary']> {
    return this.admin.dashboardSummary();
  }

  @Get('books')
  @ApiOperation({ summary: 'List books for admin' })
  listBooks(@Query() query: AdminSearchDto): ReturnType<AdminService['listBooks']> {
    return this.admin.listBooks(query);
  }

  @Get('books/:id')
  @ApiOperation({ summary: 'Get a book for admin editing' })
  getBook(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<AdminService['getBook']> {
    return this.admin.getBook(id);
  }

  @Post('books')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a book' })
  createBook(@Body() dto: CreateBookDto): Promise<{ id: string }> {
    return this.admin.createBook(dto);
  }

  @Put('books/:id')
  @ApiOperation({ summary: 'Update a book' })
  updateBook(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBookDto,
  ): Promise<{ id: string }> {
    return this.admin.updateBook(id, dto);
  }

  @Delete('books/:id')
  @ApiOperation({ summary: 'Soft-delete a book' })
  softDeleteBook(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.softDeleteBook(id);
  }

  @Post('books/:id/chapters')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        delimiter: { type: 'string' },
        replace: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({
    summary: 'Bulk-import chapters from a .txt upload (sections split by --- by default)',
  })
  bulkImport(
    @Param('id', new ParseUUIDPipe({ version: '4' })) bookId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @Query() options: BulkImportOptionsDto,
  ): Promise<{ created: number }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.admin.bulkImportChapters(bookId, file.buffer, options);
  }

  @Post('books/:id/chapters/bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk-create chapters from parsed client content' })
  bulkCreateChapters(
    @Param('id', new ParseUUIDPipe({ version: '4' })) bookId: string,
    @Body() dto: BulkCreateChaptersDto,
  ): Promise<{ created: number }> {
    return this.admin.bulkCreateChapters(bookId, dto.chapters);
  }

  @Get('chapters')
  @ApiOperation({ summary: 'List chapters for admin' })
  listChapters(@Query() query: AdminChapterListDto): ReturnType<AdminService['listChapters']> {
    return this.admin.listChapters(query);
  }

  @Get('chapters/:id')
  @ApiOperation({ summary: 'Get chapter for admin editing' })
  getChapter(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<AdminService['getChapter']> {
    return this.admin.getChapter(id);
  }

  @Put('chapters/:id')
  @ApiOperation({ summary: 'Update a chapter (metadata or content)' })
  updateChapter(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateChapterDto,
  ): Promise<{ id: string }> {
    return this.admin.updateChapter(id, dto);
  }

  @Delete('chapters/:id')
  @ApiOperation({ summary: 'Soft-delete a chapter' })
  softDeleteChapter(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.softDeleteChapter(id);
  }

  @Get('dramas')
  @ApiOperation({ summary: 'List dramas for admin' })
  listDramas(@Query() query: AdminSearchDto): ReturnType<AdminService['listDramas']> {
    return this.admin.listDramas(query);
  }

  @Get('dramas/:id')
  @ApiOperation({ summary: 'Get a drama for admin editing' })
  getDrama(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<AdminService['getDrama']> {
    return this.admin.getDrama(id);
  }

  @Post('dramas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a drama' })
  createDrama(@Body() dto: CreateDramaDto): Promise<{ id: string }> {
    return this.admin.createDrama(dto);
  }

  @Put('dramas/:id')
  @ApiOperation({ summary: 'Update a drama' })
  updateDrama(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDramaDto,
  ): Promise<{ id: string }> {
    return this.admin.updateDrama(id, dto);
  }

  @Delete('dramas/:id')
  @ApiOperation({ summary: 'Soft-delete a drama' })
  softDeleteDrama(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.softDeleteDrama(id);
  }

  @Post('dramas/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a drama' })
  publishDrama(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.publishDrama(id);
  }

  @Post('dramas/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish a drama' })
  unpublishDrama(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.unpublishDrama(id);
  }

  @Get('episodes')
  @ApiOperation({ summary: 'List drama episodes for admin' })
  listEpisodes(
    @Query() query: AdminChapterListDto & { dramaId?: string },
  ): ReturnType<AdminService['listEpisodes']> {
    return this.admin.listEpisodes(query);
  }

  @Get('episodes/:id')
  @ApiOperation({ summary: 'Get a drama episode for admin editing' })
  getEpisode(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<AdminService['getEpisode']> {
    return this.admin.getEpisode(id);
  }

  @Post('episodes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a drama episode' })
  createEpisode(@Body() dto: CreateEpisodeDto): Promise<{ id: string }> {
    return this.admin.createEpisode(dto);
  }

  @Put('episodes/:id')
  @ApiOperation({ summary: 'Update a drama episode' })
  updateEpisode(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEpisodeDto,
  ): Promise<{ id: string }> {
    return this.admin.updateEpisode(id, dto);
  }

  @Delete('episodes/:id')
  @ApiOperation({ summary: 'Soft-delete a drama episode' })
  softDeleteEpisode(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.softDeleteEpisode(id);
  }

  @Post('episodes/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a drama episode' })
  publishEpisode(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.publishEpisode(id);
  }

  @Post('episodes/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish a drama episode' })
  unpublishEpisode(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ id: string }> {
    return this.admin.unpublishEpisode(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Search users for admin' })
  listUsers(@Query() query: AdminSearchDto): ReturnType<AdminService['listUsers']> {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail for admin' })
  getUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): ReturnType<AdminService['getUser']> {
    return this.admin.getUser(id);
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a user' })
  banUser(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<{ id: string }> {
    return this.admin.banUser(id);
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban a user' })
  unbanUser(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<{ id: string }> {
    return this.admin.unbanUser(id);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Search orders for admin' })
  listOrders(@Query() query: AdminOrderListDto): ReturnType<AdminService['listOrders']> {
    return this.admin.listOrders(query);
  }

  @Post('uploads/cover-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a presigned cover upload URL' })
  coverUploadUrl(@Body() dto: CoverUploadUrlDto): Promise<{ uploadUrl: string; key: string }> {
    return this.admin.coverUploadUrl(dto.contentType);
  }
}
