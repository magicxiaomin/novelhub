# Postmortem: Lessons Learned

This file is the running memory of the auto-pipeline. Each entry is a ≤200-word
lesson distilled by `claude-postmerge.yml` after a `feature/NN-*` PR merges to
`main`. `claude-plan.yml` reads this file when generating the next ticket's
plan, and `claude-review.yml` reads it when reviewing the next PR. The point is
to stop re-discovering the same traps.

Entries are append-only and ordered most-recent-first. Do not edit older entries
to "fix" them — they reflect what we learned at that point in time.

---

## Ticket 11 — Facebook Pixel and CAPI Integration

**What worked:** Idempotency anchored on `FbEvent.eventId` unique constraint with `P2002` short-circuit in `apps/api/src/modules/fb-capi/fb-capi.service.ts` makes Stripe webhook redeliveries safe; using `stripeSessionId` as the shared `event_id` for Purchase/Subscribe gives Pixel↔CAPI dedup for free. Storing `fbConsent` + `fbUserData` on `Order.metadata` at checkout creation lets the webhook publish CAPI without re-deriving cookies that the webhook request never has.

**Pitfalls hit:**

- **Subscription webhook silently skipped Subscribe CAPI.** `WebhookService.handleCheckoutCompleted` originally only published the purchase event on the COIN_PURCHASE branch; the SUBSCRIPTION branch just marked the order completed, so Subscribe never fired despite Pixel sending it client-side — a one-sided dedup that Meta would surface as a phantom browser-only event. Fixed in `apps/api/src/modules/payments/webhook.service.ts` by reading the Order's `amount`/`currency` and calling `purchasePublisher.publish` on the SUBSCRIPTION branch too.
- **Access token risk in URL/payload.** `FbCapiService` sends the FB token in the JSON body (not querystring) and excludes it from the persisted `FbEvent.payload`; tests assert this. Don't regress.

**Rule for future tickets:** When a webhook handler fans out per `orderType`, every branch must be wired through the same side-effect publishers — not just the first one. Add a webhook test per branch (see the new `checkout.session.completed (subscription order)` test in `webhook.service.spec.ts`) and never put third-party access tokens in URLs or persisted payloads.

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
