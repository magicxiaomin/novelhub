// 5s ceiling on each OneSignal HTTP call. Their API normally responds in
// <500ms; anything longer means an incident and we'd rather fail fast than
// pin a worker waiting on a hung connection. The 5/min throttle in front of
// grantBonus already bounds blast radius if every retry trips this.
const ONESIGNAL_REQUEST_TIMEOUT_MS = 5000;

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

type OneSignalSubscription = {
  id?: unknown;
  type?: unknown;
  enabled?: unknown;
};

type OneSignalUserResponse = {
  subscriptions?: OneSignalSubscription[];
};

export type OneSignalClientDeps = {
  apiKey: string | undefined;
  appId: string | undefined;
};

const log = {
  warn(msg: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[OneSignalClient] ${msg}`);
  },
};

export class OneSignalClient {
  private readonly apiKey: string | undefined;
  private readonly appId: string | undefined;

  constructor(deps: OneSignalClientDeps) {
    this.apiKey = deps.apiKey;
    this.appId = deps.appId;
    if (!this.apiKey) {
      log.warn('ONESIGNAL_REST_API_KEY is not configured; push sends are disabled.');
    }
    if (!this.appId) {
      log.warn('NEXT_PUBLIC_ONESIGNAL_APP_ID is not configured; push sends are disabled.');
    }
  }

  async sendNotification(input: OneSignalSendInput): Promise<{ sent: boolean; id?: string }> {
    if (!this.apiKey || !this.appId) {
      log.warn('Skipping OneSignal notification because credentials are missing.');
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

    let res: Response;
    try {
      res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        signal: AbortSignal.timeout(ONESIGNAL_REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Basic ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      log.warn(`OneSignal send aborted: ${describeFetchError(err)}`);
      return { sent: false };
    }

    if (!res.ok) {
      const body = await res.text();
      log.warn(`OneSignal send failed with ${res.status}: ${body}`);
      return { sent: false };
    }

    const parsed = (await res.json()) as { id?: string };
    return { sent: true, id: parsed.id };
  }

  async hasActivePushSubscription(userId: string): Promise<boolean> {
    if (!this.apiKey || !this.appId) {
      log.warn('Skipping OneSignal subscription check because credentials are missing.');
      return false;
    }

    let res: Response;
    try {
      res = await fetch(
        `https://api.onesignal.com/apps/${encodeURIComponent(this.appId)}/users/by/external_id/${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(ONESIGNAL_REQUEST_TIMEOUT_MS),
          headers: {
            Authorization: `Key ${this.apiKey}`,
            Accept: 'application/json',
          },
        },
      );
    } catch (err) {
      log.warn(`OneSignal subscription check aborted: ${describeFetchError(err)}`);
      return false;
    }

    if (!res.ok) {
      const body = await res.text();
      log.warn(`OneSignal subscription check failed with ${res.status}: ${body}`);
      return false;
    }

    const parsed = (await res.json()) as OneSignalUserResponse;
    return (
      parsed.subscriptions?.some(
        (subscription) =>
          typeof subscription.id === 'string' &&
          subscription.id.length > 0 &&
          subscription.enabled === true &&
          isWebPushSubscriptionType(subscription.type),
      ) ?? false
    );
  }
}

const isWebPushSubscriptionType = (type: unknown): boolean =>
  typeof type === 'string' && type.toLowerCase().replace(/[\s_-]/g, '') === 'webpush';

const describeFetchError = (err: unknown): string => {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return `request timed out after ${ONESIGNAL_REQUEST_TIMEOUT_MS}ms`;
    }
    return err.message;
  }
  return 'unknown error';
};
