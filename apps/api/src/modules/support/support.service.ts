import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

import type { ContactDto } from './dto/contact.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  async contact(dto: ContactDto): Promise<{ delivered: boolean }> {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.SUPPORT_EMAIL;
    const from = process.env.SUPPORT_FROM_EMAIL;
    if (!apiKey || !to || !from) {
      this.logger.warn('Support contact email is not configured; short-circuiting delivery');
      return { delivered: false };
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      replyTo: dto.email,
      subject: `[NovelHub] ${dto.subject}`,
      text: [`Name: ${dto.name}`, `Email: ${dto.email}`, '', dto.body].join('\n'),
    });
    return { delivered: true };
  }
}
