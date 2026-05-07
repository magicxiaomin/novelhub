const SENSITIVE_KEYS = ['email', 'password', 'token', 'authorization', 'cookie', 'meta'] as const;

type SentryScrubbableEvent = {
  request?: unknown;
  extra?: unknown;
  contexts?: unknown;
};

const scrub = (value: unknown): void => {
  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))) {
      record[key] = '[REDACTED]';
      continue;
    }

    scrub(record[key]);
  }
};

export const scrubSentryEvent = <TEvent extends SentryScrubbableEvent>(event: TEvent): TEvent => {
  scrub(event.request);
  scrub(event.extra);
  scrub(event.contexts);

  return event;
};
