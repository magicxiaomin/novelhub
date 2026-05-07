import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

import { CACHE_CLIENT, type CacheClient } from '../cache/cache.constants';

import type { ContactDto } from './dto/contact.dto';

// Cap submissions per email at 3 per rolling 24h window. Even if a botnet
// rotates IPs (defeating the IP throttle), they have to rotate emails too,
// which is costlier and also makes the noise easier to spot in Resend logs.
const SUPPORT_PER_EMAIL_LIMIT = 3;
const SUPPORT_PER_EMAIL_WINDOW_SECONDS = 24 * 60 * 60;

// Strip CR/LF from any value that ends up in a header field. Resend already
// rejects most header injection attempts, but this is the cheapest possible
// defense in depth and mirrors what every mail library does at the boundary.
const stripHeaderControlChars = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(@Inject(CACHE_CLIENT) private readonly cache: CacheClient) {}

  async contact(dto: ContactDto): Promise<{ delivered: boolean }> {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.SUPPORT_EMAIL;
    const from = process.env.SUPPORT_FROM_EMAIL;
    if (!apiKey || !to || !from) {
      this.logger.warn('Support contact email is not configured; short-circuiting delivery');
      return { delivered: false };
    }

    const emailKey = `support:contact:${dto.email.trim().toLowerCase()}`;
    const previous = (await this.cache.get<number>(emailKey)) ?? 0;
    if (previous >= SUPPORT_PER_EMAIL_LIMIT) {
      throw new HttpException(
        'Daily contact limit reached for this email. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      replyTo: dto.email,
      subject: `[NovelHub] ${stripHeaderControlChars(dto.subject)}`,
      text: [
        `Name: ${stripHeaderControlChars(dto.name)}`,
        `Email: ${stripHeaderControlChars(dto.email)}`,
        '',
        dto.body,
      ].join('\n'),
    });

    // Refresh the TTL on every successful send so a slow attacker can't
    // creep above the cap by spreading submissions across the window edges.
    await this.cache.set(emailKey, previous + 1, SUPPORT_PER_EMAIL_WINDOW_SECONDS);
    return { delivered: true };
  }
}
