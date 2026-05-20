# Wave 2AN planning gap audit

Linked issues: #588, #586, #233, #566

This is a docs-only planning audit for the novels-only funnel. It cites the canonical coverage map, `docs/pivot/novels-funnel-coverage.md`, instead of recreating or superseding it. The canonical map remains the source of truth for detailed surface-to-spec traceability.

## Canonical map read

The six canonical funnel stages are covered at summary level in `docs/pivot/novels-funnel-coverage.md`:

- Ad landing: home, novels discovery, and Playwright novel-funnel entry coverage are listed in the canonical map.
- Novel detail: book detail, metadata, JSON-LD, reader metadata, and e2e novel-funnel coverage are listed in the canonical map.
- Free chapters: reader route, anonymous progress, reader content helpers, book/chapters Worker route contracts, and reading-progress coverage are listed in the canonical map.
- Paywall: locked-reader paywall, return-url, unlock route contracts, and paywall component characterization are listed in the canonical map.
- Purchase/unlock: Stripe/webhook, payments, coins, subscriptions, unlock services, and Worker route contracts are listed in the canonical map.
- Library: account/library/resume-reading, auth route-contract, and reading-progress coverage are listed in the canonical map.

## Do not duplicate

Do not create new coverage work that merely repeats these already-covered surfaces:

- Auth route contracts: `apps/api/src/worker/routes/auth.contract.spec.ts`, plus existing auth route/service/strategy specs.
- Unlocks: `apps/api/src/worker/routes/unlocks.contract.spec.ts` and `apps/api/src/modules/unlocks/unlocks.service.spec.ts`.
- Payments: `apps/api/src/worker/routes/payments.contract.spec.ts`, `apps/api/src/modules/payments/payments.service.spec.ts`, `apps/api/src/modules/payments/webhook.service.spec.ts`, and `apps/api/test/payments-webhook.spec.ts`.
- Coins: `apps/api/src/worker/routes/coins.contract.spec.ts` and `apps/api/src/modules/coins/coins.service.spec.ts`.
- Reading progress: `apps/api/src/worker/routes/reading-progress.contract.spec.ts`, `apps/api/src/worker/routes/reading-progress.validation.spec.ts`, `apps/api/src/modules/reading-progress/reading-progress.service.spec.ts`, and e2e reading-progress coverage.
- Books: `apps/api/src/worker/routes/books.contract.spec.ts`, `apps/api/src/modules/books/books.service.spec.ts`, book-detail page specs, and book metadata specs.
- Chapters: `apps/api/src/worker/routes/chapters.contract.spec.ts`, chapter service specs, reader route specs, and reader helper specs.
- Home/novels landing: `apps/web/src/app/page.spec.ts`, `apps/web/src/components/home/novel-home-page.spec.tsx`, `apps/web/src/app/novels/page.spec.ts`, novels filter/canonical redirect specs, and support-surface specs.
- Playwright novel-funnel coverage: `tests/e2e/specs/novel-funnel.spec.ts` and adjacent funnel e2e specs cited by the canonical map.

## Next-gap verdict

No precise non-duplicate repository coverage gap is identified from this audit. The next action is to avoid opening another broad funnel-coverage characterization issue unless a future audit can name one exact uncovered behavior, target file, and assertion that is not already represented in `docs/pivot/novels-funnel-coverage.md`.

Open issue #233 / Kanban `t_030c3f29` remains the external launch-verification blocker. That blocker requires external/staging evidence and is not a repository test-gap to duplicate here.

Open issue #566 remains separate staging admin import work. This audit does not approve, perform, or scope staging writes/imports and does not convert #566 into funnel coverage work.

## Canonical-map SHA verdict

Keep the canonical map snapshot pinned at `9d54af288d79cdf703536a77cf4579477bbb96f9`; do not bump it to `c770c52e783ab323cc9e354a9c5a82aecc89183d` in this issue.

Rationale: the canonical map already records the Wave 2AM evidence needed for this planning audit, including PR #584 auth route-contract characterization and PR #585 coverage refresh context, while preserving #233 as the open external launch-verification blocker. This audit found no concrete stale statement that requires editing `docs/pivot/novels-funnel-coverage.md` by default.

If a future reviewer identifies a concrete stale map statement, quote that statement and create a separately approved narrow follow-up. Do not edit the canonical coverage map from this issue without that approval.

## Preserved boundaries and hard exclusions

- No production deploy, DNS, CDN, certificate, secrets, environment, credential, or staging mutation.
- No live Stripe/payment mutation and no live Meta Pixel, CAPI, Stape, or tracking verification evidence.
- No destructive database, data, schema, R2, KV, import, Prisma migration, source-code, package, lockfile, runtime, or application behavior change.
- No #233 unblock, resolution, bypass, or evidence claim.
- No #566 staging write/import, staging data mutation, or admin-import readiness claim.
- No drama reactivation; drama remains quarantined under `docs/pivot/quarantine-register.md` and related pivot docs.
- No launch approval, production-readiness approval, roadmap approval, ADR update, new directive, or new gap ticket.
