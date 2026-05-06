import {
  Body,
  Controller,
  Delete,
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
import { BulkImportOptionsDto, UpdateChapterDto } from './dto/chapter.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
      throw new Error('File is required'); // ValidationPipe handles other DTOs; this is a multipart edge case
    }
    return this.admin.bulkImportChapters(bookId, file.buffer, options);
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
}
