# Drama true-delete runbook

Linked issues: #195, #204, #213, #214, #215, #216, #217, #218, #219, #220, #221

This runbook records the repo-versioned plan for retiring short-drama surfaces after the novels-only pivot. It summarizes the #204 destructive-cleanup proposal gate, the #220 repo-only static inventory, and the staged implementation issue map. It is a planning artifact only.

## Authorization boundary

No production DB writes, Prisma migrations, table drops, row deletes, Cloudflare R2 deletes or lifecycle rules, Stripe product/price changes, DNS/domain/certificate/CDN changes, secrets changes, or live environment mutations are authorized by this document, #221, #220, #204, or #195.

Any destructive DB/data/media action requires a separate issue, explicit product owner/operator approval, verified backups/rollback, and runtime evidence from least-privilege credentials. Historical Prisma migrations must remain immutable unless a separate approved migration issue says otherwise.

## Source plan summary

### #195 novels-only pivot

#195 establishes that NovelHub now focuses exclusively on web novels. Drama product work is deprecated and frozen except for approved removal/archival work. The active funnel is the novel path documented in `docs/pivot/funnel.md`: ad landing -> novel detail -> free chapters -> paywall -> purchase/unlock -> library.

### #204 true-delete planning gate

#204 is a hard-gated proposal issue for any future destructive drama cleanup. Its deliverables are inventory, retain/archive/delete options, risk/legal/retention analysis, rollback and backup planning, and an explicit human approval checklist. It expressly forbids implementation during the planning gate and requires separate approval before any destructive follow-up.

The intended true-delete order is child-first and evidence-driven:

1. Collect read-only DB/R2 evidence and classify real user/paid activity.
2. Decide paid unlock retention/refund/export/read-only behavior and public response contracts.
3. Ship reversible cutoff before deleting code or data.
4. Remove public web/client surfaces after cutoff soak.
5. Remove API/admin/worker surfaces after web removal.
6. Remove tests, smoke fixtures, seed packs, and telemetry fixtures after no callers remain.
7. Clean docs/env examples last.
8. Only then consider a separately approved schema/table/media deletion wave.

### #220 static inventory

#220 performed repo-only/static preparation from latest `origin/main`. It did not run DB queries, Prisma migrations, R2 listing/deletion, Stripe/DNS/secrets/live-env changes, or implementation changes. Its verdict was to revise the implementation split so #215 remains a very small reversible cutoff and #216-#219 carry staged deletion/removal work. The #220 recommendations were incorporated into #215-#219.

#220 also identified likely conflicts with merged novel telemetry work in PR #212. Future deletion PRs must rebase over novel funnel telemetry and message changes rather than deleting broad telemetry files wholesale.

## Static drama inventory from #220

The following inventory excludes false-positive static public-domain chapter prose that mentions drama as ordinary text.

### Web/client surfaces

- `apps/web/src/app/dramas/page.tsx`
- `apps/web/src/app/dramas/loading.tsx`
- `apps/web/src/app/dramas/error.tsx`
- `apps/web/src/app/dramas/[slug]/page.tsx`
- `apps/web/src/app/dramas/[slug]/not-found.tsx`
- `apps/web/src/app/dramas/[slug]/watch/[episodeId]/page.tsx`
- `apps/web/src/app/dramas/[slug]/watch/[episodeId]/loading.tsx`
- `apps/web/src/app/dramas/[slug]/watch/[episodeId]/error.tsx`
- `apps/web/src/components/drama/drama-card.tsx`
- `apps/web/src/components/drama/drama-player.tsx`
- `apps/web/src/components/drama/drama-rail.tsx`
- `apps/web/src/lib/drama-player.ts`
- `apps/web/src/lib/drama-player.spec.ts`
- `apps/web/src/lib/drama-e2e-fixtures.ts`
- `apps/web/src/lib/drama-e2e-fixture-gate.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/queries.ts`
- `apps/web/src/lib/server-api.ts`
- `apps/web/src/lib/server-api.spec.ts`
- `apps/web/src/lib/api-config.ts`
- `apps/web/src/lib/api.spec.ts`
- `apps/web/src/lib/fb-pixel.spec.ts`
- `apps/web/src/app/page.tsx`

### API/admin/worker surfaces

- `apps/api/src/modules/drama/dramas.service.ts`
- `apps/api/src/modules/drama/dramas.service.spec.ts`
- `apps/api/src/modules/drama/dramas.types.ts`
- `apps/api/src/modules/admin/admin.controller.ts`
- `apps/api/src/modules/admin/admin.service.ts`
- `apps/api/src/modules/admin/admin.service.spec.ts`
- `apps/api/src/modules/admin/admin.module.ts`
- `apps/api/src/modules/admin/dto/drama.dto.ts`
- `apps/api/src/modules/admin/dto/drama.dto.spec.ts`
- `apps/api/src/modules/admin/dto/drama.types.ts`
- `apps/api/src/worker.ts`
- `apps/api/src/worker/routes/dramas.ts`
- `apps/api/src/worker/routes/dramas.schemas.ts`
- `apps/api/src/worker/routes/dramas.spec.ts`
- `apps/api/src/worker/routes/episodes.ts`
- `apps/api/src/worker/routes/drama-progress.ts`
- `apps/api/src/worker/routes/drama-quarantine.ts`
- `apps/api/src/worker/routes/drama.contract.spec.ts`
- `apps/api/src/worker/routes/drama-process-validation-fallback.ts`
- `apps/api/src/worker/services/dramas-factory.ts`
- `apps/api/src/worker/services/auth-factory.ts`
- `apps/api/src/worker/routes/auth.spec.ts`
- `apps/api/src/worker/cookies.spec.ts`
- `apps/api/src/config/domain.ts`
- `apps/api/src/config/domain.spec.ts`

### DB/schema/seed surfaces

Inventory only. Do not mutate these in the staged non-destructive removal wave unless the specific issue permits seed/test cleanup, and never apply live DB changes from these docs.

- `packages/db/prisma/schema.prisma`: `Drama`, `Episode`, `VideoAsset`, `EpisodeUnlock`, `WatchProgress`; mapped columns include `drama_id`, `episode_id`, and `playback_url`.
- `packages/db/prisma/migrations/20260510000000_add_short_drama_domain/migration.sql`
- `packages/db/prisma/seed.mjs`
- `packages/db/prisma/staging-suspense-1913.seed.mjs`
- `packages/db/prisma/production-suspense-1913.seed.mjs`
- `packages/db/prisma/staging-suspense-1913.seed.test.mjs`

### Tests, smoke, fixtures, CI, shared, env, and docs

- `tests/e2e/specs/drama-regression.spec.ts`
- `tests/e2e/specs/homepage-drama-quarantine.spec.ts`
- `tests/e2e/fixtures/drama.ts`
- `tests/e2e/README.md`
- `tests/e2e/playwright.config.ts`
- `scripts/smoke.sh`
- `scripts/smoke.test.sh`
- `.github/workflows/e2e.yml`
- `.github/workflows/deploy-web.yml`
- `packages/shared/src/drama-e2e-fixtures.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/messages/en.json`
- `.env.example`
- `README.md`
- `AGENTS.md`
- `CODEX_QUICKSTART.md`
- `docs/adr/0001-novels-only-pivot.md`
- `docs/adr/drama-data-model.md`
- `docs/adr/drama-domain-routing-auth-cors.md`
- `docs/adr/drama-phase3-feasibility-resolution.md`
- `docs/adr/drama-video-pipeline.md`
- `docs/handoff-2026-05-10.md`
- `docs/operations.md`
- `docs/phase3-short-drama-implementation-plan.md`
- `docs/phase3-short-drama-mvp-spec.md`
- `docs/phase3-short-drama-ux-spec.md`
- `docs/phase4-alpha-qa-launch-readiness-plan.md`
- `docs/pivot/funnel.md`
- `docs/pivot/quarantine-register.md`
- `docs/staging-drama-pack-suspense-1913.md`

## Staged issue map

| Issue | Stage                                              | Status/gates                                                                                    | Scope                                                                                                                                                                | Required checks                                                                                                |
| ----- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| #213  | Read-only drama DB and R2 inventory evidence       | Open; blocked until least-privilege read-only DB role and list-only R2 credential are available | Counts for drama tables, paid unlock breakdown, authenticated vs guest activity, FK/table map, R2 bucket identity and `dramas/` listing summary                      | Read-only commands only; no writes, no migrate/db push, no R2 deletes                                          |
| #214  | Paid unlock retention and cutoff response decision | Depends on #213 evidence                                                                        | PO/finance decision on retain/refund/export/read-only access, 410 vs 404 vs redirect contract, user comms                                                            | Decision comment only; no live changes                                                                         |
| #215  | Reversible public/admin drama cutoff               | Requires #213 evidence and #214 written decision before merge                                   | Prevent public/admin drama browsing, playback URL exposure, HLS URL exposure, progress/unlock writes according to response contract; keep files present for rollback | `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, targeted API/web tests from #215 |
| #216  | Remove drama web/client surfaces                   | Depends on #215 merged and soak/approval                                                        | Delete `/dramas` route files, drama components, client helpers, web references; preserve novel funnel                                                                | Web typecheck/lint/test, novel funnel e2e, repo grep gate for web drama leftovers                              |
| #217  | Remove drama API/admin services and fallback       | Depends on #216                                                                                 | Remove worker route registration, drama services/factory, admin drama/episode CRUD and DTOs; leave Prisma schema/migrations/tables untouched                         | API typecheck/lint/test, grep for intentional leftovers                                                        |
| #218  | Remove drama tests, seeds, and telemetry fixtures  | Depends on #217                                                                                 | Delete/rewrite drama Playwright/Jest/Vitest/smoke/shared fixtures and seed packs; preserve #212 novel telemetry                                                      | Shared build/test, novel funnel e2e, `pnpm test`, grep/classify leftovers                                      |
| #219  | Docs and env-example cleanup                       | Depends on #218; may draft earlier but should merge last                                        | Supersede drama docs/env/workflow references without erasing audit history; state live teardown out of scope                                                         | `pnpm format:check`, repo grep/classification                                                                  |

## Hard gates

- #213 requires an actual read-only DB role and list-only R2 credential. If credentials are unavailable, #213 must block with the exact credential requirement rather than substituting static assumptions.
- #214 must produce written PO + finance decisions before #215 can merge.
- #215 must remain reversible: no deletion wave, no schema changes, no seed removal, no media deletion.
- #216 requires soak/approval after #215 and confirmation that no paid unlock/support exception requires a temporary read-only path.
- #217 must not drop Prisma models, tables, or applied migrations.
- #218 must preserve PR #212 novel funnel telemetry and should not delete broad telemetry files wholesale.
- #219 should merge last so docs/env examples describe the final repo state after code/test/seed removal.
- Any true DB/schema/R2 deletion after #219 needs a separate approved issue with backups, rollback, evidence artifacts, checksums, and explicit operator approval.

## Non-goals

- Do not delete production database tables or rows.
- Do not run Prisma migrate, Prisma db push, manual SQL `DROP`/`DELETE`/`TRUNCATE`/`ALTER`, or any live DB mutation.
- Do not delete Cloudflare R2 objects, buckets, lifecycle rules, or media prefixes.
- Do not change Stripe live products/prices, payment configuration, refunds, subscriptions, entitlements, DNS, domains, certificates, CDN, secrets, or live environment variables.
- Do not rename the brand/domain or perform production cutover.
- Do not implement a new CMS or new novel product scope while doing drama deletion cleanup.
- Do not silently erase audit history; supersede historical drama docs with links to #195/#204/#220 instead.

## Operator checklist before any future destructive wave

A future destructive schema/data/media issue is not approved until all of the following are present in that issue or linked artifacts:

- #213 evidence artifacts and checksums, with sensitive values redacted.
- #214 retention/refund/export/read-only-access decision and user communications decision.
- Backup and rollback plan for database and R2 media.
- Child-first table/FK deletion order verified against the live schema.
- R2 object count/size/sample listing for the exact prefix/bucket to be deleted.
- Explicit list of tables, rows, prefixes, and assets in scope.
- Explicit out-of-scope list for Stripe, DNS, domains, CDN, certificates, secrets, and unrelated novel data.
- Human approval comment that names the issue and authorizes the exact destructive actions.
