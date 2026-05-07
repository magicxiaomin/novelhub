import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ContactDto } from './dto/contact.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('contact')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a support contact request' })
  @ApiBody({ type: ContactDto })
  contact(@Body() dto: ContactDto): Promise<{ delivered: boolean }> {
    return this.support.contact(dto);
  }
}
