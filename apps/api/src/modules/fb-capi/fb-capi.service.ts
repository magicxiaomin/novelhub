import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

import { PRISMA } from '../auth/auth.constants';

import { FB_CONSENT_ACCEPTED, FB_CONSENT_COOKIE, FB_GRAPH_API_VERSION } from './fb-capi.constants';
import type { FbCustomData, FbEventPayload, FbUserData } from './fb-capi.types';

@Injectable()
export class FbCapiService {
  private readonly logger = new Logger(FbCapiService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async sendEvent(
    eventName: string,
    eventId: string,
    userData: FbUserData,
    customData?: FbCustomData,
    userId?: string,
  ): Promise<void> {
    const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
    const token = process.env.FB_CAPI_ACCESS_TOKEN;
    if (!pixelId || !token) {
      this.logger.warn('FB CAPI is not configured; skipping event');
      return;
    }

    try {
      const existing = await this.prisma.fbEvent.findUnique({
        where: { eventId },
        select: { id: true },
      });
      if (existing) return;

      const payload = this.buildPayload(eventName, eventId, userData, customData);
      const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${encodeURIComponent(
        pixelId,
      )}/events?access_token=${encodeURIComponent(token)}`;

      let responseCode: number | null = null;
      let responseBody: string | null = null;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        responseCode = response.status;
        responseBody = await response.text();
      } catch (err) {
        this.logger.error('FB CAPI network error', err as Error);
      }

      await this.prisma.fbEvent.create({
        data: {
          eventName,
          eventId,
          userId,
          payload,
          responseCode,
          responseBody,
        },
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      this.logger.error('FB CAPI sendEvent failed', err as Error);
    }
  }

  shouldSendForRequest(req: Request): boolean {
    return this.readCookie(req, FB_CONSENT_COOKIE) === FB_CONSENT_ACCEPTED;
  }

  extractFbUserData(req: Request, email?: string): FbUserData {
    const userAgent = req.headers['user-agent'];
    return {
      email,
      fbp: this.readCookie(req, '_fbp'),
      fbc: this.readCookie(req, '_fbc'),
      clientIpAddress: req.ip,
      clientUserAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }

  private buildPayload(
    eventName: string,
    eventId: string,
    userData: FbUserData,
    customData?: FbCustomData,
  ): FbEventPayload {
    const fbUserData: FbEventPayload['data'][number]['user_data'] = {};
    if (userData.email) {
      fbUserData.em = [this.hashEmail(userData.email)];
    }
    if (userData.fbp) fbUserData.fbp = userData.fbp;
    if (userData.fbc) fbUserData.fbc = userData.fbc;
    if (userData.clientIpAddress) fbUserData.client_ip_address = userData.clientIpAddress;
    if (userData.clientUserAgent) fbUserData.client_user_agent = userData.clientUserAgent;

    const event: FbEventPayload['data'][number] = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      user_data: fbUserData,
    };

    if (customData) {
      event.custom_data = {
        currency: customData.currency,
        value: customData.value,
        content_ids: customData.contentIds,
        content_type: customData.contentType,
      };
    }

    const payload: FbEventPayload = { data: [event] };
    if (process.env.FB_TEST_EVENT_CODE && process.env.NODE_ENV !== 'production') {
      payload.test_event_code = process.env.FB_TEST_EVENT_CODE;
    }
    return payload;
  }

  private hashEmail(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  private readCookie(req: Request, name: string): string | undefined {
    return (req as Request & { cookies?: Record<string, string> }).cookies?.[name];
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
  }
}
