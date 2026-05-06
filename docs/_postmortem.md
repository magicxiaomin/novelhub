# Postmortem: Lessons Learned

This file is the running memory of the auto-pipeline. Each entry is a ≤200-word
lesson distilled by `claude-postmerge.yml` after a `feature/NN-*` PR merges to
`main`. `claude-plan.yml` reads this file when generating the next ticket's
plan, and `claude-review.yml` reads it when reviewing the next PR. The point is
to stop re-discovering the same traps.

Entries are append-only and ordered most-recent-first. Do not edit older entries
to "fix" them — they reflect what we learned at that point in time.

---

## Ticket 08 — Reader Page and Paywall

**What worked:** Pure-function state machine for payment polling (`getPaymentSuccessState` in `apps/web/src/lib/payment-success.ts`) made the 60s timeout / 2s poll behavior unit-testable without React. Per-field sanitization in `parseReaderSettings` (each enum checked independently against an allowlist before applying) is the right shape for any localStorage-loaded config and should be copied for future client-persisted state.

**Pitfalls hit:**

- **Untrusted URLs reaching `fetch` / `router.push`.** Backend-signed chapter URLs and the `READER_RETURN_URL_KEY` value from `sessionStorage` are both attacker-influenceable. The diff guards both: `isAllowedChapterContentHost` validates against `NEXT_PUBLIC_R2_PUBLIC_HOST` / API host and enforces `https:` (`reader-content.tsx`); `isSafeReturnUrl` enforces same-origin (`payment-success-client.tsx`). Without these, a poisoned value becomes SSRF (via `next/image` `remotePatterns`) or an open redirect after Stripe.
- **SSR auth state for locked content.** `fetchChapterServer` / `fetchBookChaptersServer` forward `cookies().toString()` — without that header, server-render always treats the user as anonymous and the locked/unlocked split flickers on hydrate.
- **Frontend coupled to not-yet-shipped backend endpoints.** `saveReadingProgress` swallows 404s and `warnedProgressUnavailable` fires the toast once per session — no retry storm if a controller is still missing.

**Rule for future tickets:** Any URL originating outside our code (backend-signed, `sessionStorage`, query param) must pass an explicit allowlist before reaching `fetch`, `router.push`, `window.location.assign`, or `next/image`. SSR fetches in `apps/web/src/lib/server-api.ts` that gate on user state must forward cookies.

---

## Ticket 01 — Initialize Monorepo and Tooling

**What worked:** pnpm workspace + tsconfig path aliases set up cleanly; eslint
+ prettier + husky wired through; Sanity Checks running on PR.

**Pitfalls hit:**

- **tsconfig path alias gave a false sense of cross-package import.** `apps/api`
  could resolve `@novelhub/db` at *typecheck* time via tsconfig paths, but the
  runtime `import { prisma } from '@novelhub/db'` would fail because the package
  had no real `main` / `exports` entrypoint. Always verify cross-package imports
  with a runtime smoke test (`node -e "require('@novelhub/db')"`), not just a
  green typecheck.
- **husky pre-commit hook blocks any host without pnpm on PATH.** The hook runs
  `pnpm` literally; in environments where pnpm isn't installed (sandbox
  containers, fresh dev machines, CI without setup-node) the commit silently
  fails. Either install pnpm in every workflow before committing, or push via
  GitHub API (which bypasses local hooks).
- **`pnpm install --frozen-lockfile` fails the moment any `package.json`
  changes.** When adding a new workspace dependency, the lockfile MUST be
  refreshed with `--no-frozen-lockfile` first and the updated `pnpm-lock.yaml`
  committed in the same PR. Don't expect frozen-install to "auto-fix" mismatch.

**Rule for future tickets:** any cross-package import gets a runtime smoke
test in CI; lockfile updates ride with the dependency PR they enable.
