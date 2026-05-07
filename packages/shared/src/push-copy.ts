import messagesJson from './messages/en.json';

const cron = messagesJson.pushNotifications;

/**
 * Push notification copy used by API cron handlers. The strings live in
 * `messages/en.json` under `pushNotifications.*` so AGENTS.md's "all
 * user-facing strings in messages/en.json" rule holds for backend
 * notifications too. When backend i18n becomes locale-aware, swap this
 * for a per-user-locale lookup against the same JSON file.
 */
export const PUSH_COPY = {
  reEngagement: {
    title: (bookTitle: string): string =>
      cron.reEngagement.titleTemplate.replace('{bookTitle}', bookTitle),
    body: cron.reEngagement.body,
  },
  renewalReminder: {
    title: cron.renewalReminder.title,
    body: cron.renewalReminder.body,
  },
} as const;
