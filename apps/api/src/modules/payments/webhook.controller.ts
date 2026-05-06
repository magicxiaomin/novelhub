import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { WebhookService } from './webhook.service';

/**
 * Stripe webhook entry point.
 *
 * - NOT behind any auth guard — Stripe authenticates via signature, not JWT.
 * - Skips throttling so a burst of legitimate Stripe events doesn't get
 *   429'd. Stripe will retry but the user-visible state lag matters.
 * - Reads the request as raw bytes so the signature verification matches
 *   exactly what Stripe sent (any JSON re-serialization changes the bytes
 *   and breaks HMAC).
 */
@ApiTags('payments')
@Controller('payments')
@SkipThrottle()
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook handler (signature-verified)' })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true; type: string }> {
    if (!req.rawBody) {
      // ValidationPipe / body-parser stripped the raw body. Configuration error.
      throw new Error('Raw body unavailable on request — main.ts must enable rawBody:true');
    }
    return this.webhook.handleEvent(req.rawBody, signature);
  }
}
