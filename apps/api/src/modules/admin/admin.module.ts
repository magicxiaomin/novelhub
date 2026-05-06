import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';

import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, BooksModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
  exports: [AdminGuard],
})
export class AdminModule {}
