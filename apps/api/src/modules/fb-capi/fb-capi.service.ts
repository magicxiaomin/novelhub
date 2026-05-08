import type { PrismaClient } from '@prisma/client';

import { parseConsent } from '@novelhub/shared';

import { CONSENT_COOKIE, FB_GRAPH_API_VERSION } from './fb-capi.constants';
import type { FbCustomData, FbEventPayload, FbUserData } from './fb-capi.types';

export type FbCapiServiceDeps = {
  prisma: PrismaClient;
  pixelId: string | undefined;
  accessToken: string | undefined;
  // Optional sandbox-mode test event code; suppressed in production. Maps
  // to FB_TEST_EVENT_CODE on the Nest stack and the same env var on Workers.
  testEventCode: string | undefined;
  isProduction: boolean;
};

// Structural request type. The Nest controller hands us an Express
// `Request` with `cookies` populated by `cookie-parser`; the Worker hands
// us a per-request bag we build from `c.req.header('cookie')` + `c.env`.
// Either way we only need cookies + ip + user-agent.
export type FbCapiRequest = {
  cookies?: Record<string, string>;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

const log = {
  warn(msg: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[FbCapiService] ${msg}`);
  },
  error(msg: string, err?: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[FbCapiService] ${msg}`, err);
  },
};

// Web Crypto SHA-256 → lowercase hex. Both Node 19+ and Workers expose
// `crypto.subtle` on the global. The structural type avoids depending on
// `SubtleCrypto` (which the Worker tsconfig has but Node tsconfig does
// not, since we don't pull lib.dom into the Nest build).
type WebCryptoDigest = {
  digest(algorithm: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
};
const subtle = (globalThis as unknown as { crypto: { subtle: WebCryptoDigest } }).crypto.subtle;

const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < view.length; i += 1) {
    out += view[i]!.toString(16).padStart(2, '0');
  }
  return out;
};

export class FbCapiService {
  private readonly prisma: PrismaClient;
  private readonly pixelId: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly testEventCode: string | undefined;
  private readonly isProduction: boolean;

  constructor(deps: FbCapiServiceDeps) {
    this.prisma = deps.prisma;
    this.pixelId = deps.pixelId;
    this.accessToken = deps.accessToken;
    this.testEventCode = deps.testEventCode;
    this.isProduction = deps.isProduction;
  }

  async sendEvent(
    eventName: string,
    eventId: string,
    userData: FbUserData,
    customData?: FbCustomData,
    userId?: string,
  ): Promise<void> {
    if (!this.pixelId || !this.accessToken) {
      log.warn('FB CAPI is not configured; skipping event');
      return;
    }

    try {
      const payload = await this.buildPayload(eventName, eventId, userData, customData);
      try {
        await this.prisma.fbEvent.create({
          data: {
            eventName,
            eventId,
            userId: userId ?? null,
            payload,
            // A null responseCode means we could not reach Meta on this attempt.
            responseCode: null,
            responseBody: null,
          },
        });
      } catch (err) {
        if (this.isUniqueViolation(err)) return;
        throw err;
      }

      const requestBody = { ...payload, access_token: this.accessToken };
      const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${encodeURIComponent(
        this.pixelId,
      )}/events`;

      let responseCode: number | null = null;
      let responseBody: string | null = null;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        responseCode = response.status;
        const fullText = await response.text();
        responseBody = fullText.slice(0, 4096);
      } catch (err) {
        log.error('FB CAPI network error', err);
      }

      await this.prisma.fbEvent.update({
        where: { eventId },
        data: {
          responseCode,
          responseBody,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      log.error('FB CAPI sendEvent failed', err);
    }
  }

  shouldSendForRequest(req: FbCapiRequest): boolean {
    return parseConsent(this.readCookie(req, CONSENT_COOKIE))?.marketing === true;
  }

  extractFbUserData(req: FbCapiRequest, email?: string): FbUserData {
    const userAgent = req.headers?.['user-agent'];
    return {
      email,
      fbp: this.readCookie(req, '_fbp'),
      fbc: this.readCookie(req, '_fbc'),
      clientIpAddress: req.ip,
      clientUserAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }

  private async buildPayload(
    eventName: string,
    eventId: string,
    userData: FbUserData,
    customData?: FbCustomData,
  ): Promise<FbEventPayload> {
    const fbUserData: FbEventPayload['data'][number]['user_data'] = {};
    if (userData.email) {
      fbUserData.em = [await sha256Hex(userData.email.trim().toLowerCase())];
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
    if (this.testEventCode && !this.isProduction) {
      payload.test_event_code = this.testEventCode;
    }
    return payload;
  }

  private readCookie(req: FbCapiRequest, name: string): string | undefined {
    return req.cookies?.[name];
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
  }
}
