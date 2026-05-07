// Substring matching catches `userEmail`, `passwordHash`, `accessToken`,
// `Authorization` header, etc. without having to enumerate every variant.
// `meta` was removed because Stripe and FB CAPI both have legitimate
// `metadata` fields whose contents are non-sensitive debugging context.
const SENSITIVE_KEYS = ['email', 'password', 'token', 'authorization', 'cookie'] as const;

type SentryScrubbableEvent = {
  request?: unknown;
  extra?: unknown;
  contexts?: unknown;
};

const scrub = (value: unknown, seen: WeakSet<object>): void => {
  if (!value || typeof value !== 'object') {
    return;
  }
  // WeakSet guard against circular references (e.g. error.cause chains,
  // captured request objects with self-references) so beforeSend never
  // infinite-loops + drops events under SDK timeout.
  if (seen.has(value as object)) {
    return;
  }
  seen.add(value as object);

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))) {
      record[key] = '[REDACTED]';
      continue;
    }

    scrub(record[key], seen);
  }
};

export const scrubSentryEvent = <TEvent extends SentryScrubbableEvent>(event: TEvent): TEvent => {
  const seen = new WeakSet<object>();
  scrub(event.request, seen);
  scrub(event.extra, seen);
  scrub(event.contexts, seen);

  return event;
};
