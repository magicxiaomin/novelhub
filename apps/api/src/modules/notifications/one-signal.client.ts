import { Injectable, Logger } from '@nestjs/common';

type OneSignalSendInput = {
  title: string;
  body: string;
  url?: string;
  includeExternalUserIds?: string[];
  segments?: string[];
};

type OneSignalPayload = {
  app_id: string;
  headings: { en: string };
  contents: { en: string };
  url?: string;
  include_external_user_ids?: string[];
  included_segments?: string[];
};

@Injectable()
export class OneSignalClient {
  private readonly logger = new Logger(OneSignalClient.name);
  private readonly apiKey = process.env.ONESIGNAL_REST_API_KEY;
  private readonly appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  constructor() {
    if (!this.apiKey) {
      this.logger.warn('ONESIGNAL_REST_API_KEY is not configured; push sends are disabled.');
    }
    if (!this.appId) {
      this.logger.warn('NEXT_PUBLIC_ONESIGNAL_APP_ID is not configured; push sends are disabled.');
    }
  }

  async sendNotification(input: OneSignalSendInput): Promise<{ sent: boolean; id?: string }> {
    if (!this.apiKey || !this.appId) {
      this.logger.warn('Skipping OneSignal notification because credentials are missing.');
      return { sent: false };
    }

    const payload: OneSignalPayload = {
      app_id: this.appId,
      headings: { en: input.title },
      contents: { en: input.body },
    };
    if (input.url) payload.url = input.url;
    if (input.includeExternalUserIds?.length) {
      payload.include_external_user_ids = input.includeExternalUserIds;
    }
    if (input.segments?.length) payload.included_segments = input.segments;

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`OneSignal send failed with ${res.status}: ${body}`);
      return { sent: false };
    }

    const parsed = (await res.json()) as { id?: string };
    return { sent: true, id: parsed.id };
  }
}
