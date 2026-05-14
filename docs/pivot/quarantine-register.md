# Drama quarantine register

Linked issues: #195, #196

This register classifies known short-drama artifacts for the novels-only pivot. The intent is safe quarantine, not destructive cleanup.

Disposition values:

- `retain`: keep as reference, test fixture, or rollback material; no customer exposure expected.
- `hide`: remove from active navigation, launch docs, marketing, or user-facing discovery in follow-up tickets.
- `gate`: protect runtime access behind product-mode checks, auth/admin checks, disabled responses, or similar follow-up implementation.
- `propose-later`: do not change destructively now; include in a separately approved data/schema/media cleanup proposal.

## Web routes and UI

| Artifact                                                       | Disposition | Rationale / follow-up note                                                                                      |
| -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/page.tsx` drama home/CTA references          | hide        | Home and ad-landing CTAs should point to novels-only funnel surfaces.                                           |
| `apps/web/src/app/dramas/page.tsx`                             | gate        | Drama browse route should not be active in novels-only mode; preserve file until follow-up route-gating ticket. |
| `apps/web/src/app/dramas/loading.tsx`                          | gate        | Route support file follows `/dramas` gate.                                                                      |
| `apps/web/src/app/dramas/error.tsx`                            | gate        | Route support file follows `/dramas` gate.                                                                      |
| `apps/web/src/app/dramas/[slug]/page.tsx`                      | gate        | Drama detail direct URL should be blocked or redirected in novels-only mode.                                    |
| `apps/web/src/app/dramas/[slug]/not-found.tsx`                 | gate        | Route support file follows drama detail gate.                                                                   |
| `apps/web/src/app/dramas/[slug]/watch/[episodeId]/page.tsx`    | gate        | Episode playback direct URL should be blocked in novels-only mode.                                              |
| `apps/web/src/app/dramas/[slug]/watch/[episodeId]/loading.tsx` | gate        | Route support file follows episode gate.                                                                        |
| `apps/web/src/app/dramas/[slug]/watch/[episodeId]/error.tsx`   | gate        | Route support file follows episode gate.                                                                        |
| `apps/web/src/components/drama/drama-card.tsx`                 | retain      | Component can remain as quarantined implementation history.                                                     |
| `apps/web/src/components/drama/drama-rail.tsx`                 | retain      | Component can remain as quarantined implementation history.                                                     |
| `apps/web/src/components/drama/drama-player.tsx`               | retain      | Component can remain for rollback/reference; no active route exposure in novels-only mode.                      |
| `apps/web/src/lib/drama-player.ts`                             | retain      | Utility can remain with existing unit tests while routes are gated.                                             |
| `apps/web/src/lib/drama-e2e-fixtures.ts`                       | retain      | Deterministic fixtures are useful for quarantined tests.                                                        |
| Drama strings in `packages/shared/src/messages/en.json`        | hide        | Do not surface in active UI; retain until product-mode cleanup decides whether to split/delete copy.            |

## Worker/API routes and services

| Artifact                                                                       | Disposition | Rationale / follow-up note                                                                   |
| ------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------- |
| `GET /dramas` (`apps/api/src/worker/routes/dramas.ts`)                         | gate        | Public drama browse endpoint should return disabled/not-found semantics in novels-only mode. |
| `GET /dramas/:slug` (`apps/api/src/worker/routes/dramas.ts`)                   | gate        | Public drama detail endpoint should be disabled in novels-only mode.                         |
| `GET /episodes/:episodeId/playback` (`apps/api/src/worker/routes/episodes.ts`) | gate        | Episode playback URL access must not expose drama media in novels-only mode.                 |
| `POST /episodes/:episodeId/unlock` (`apps/api/src/worker/routes/episodes.ts`)  | gate        | Drama unlock monetization path is outside active funnel.                                     |
| `POST /drama-progress` (`apps/api/src/worker/routes/drama-progress.ts`)        | gate        | Progress writes are drama-specific and should be disabled with the drama product.            |
| `apps/api/src/worker/routes/dramas.schemas.ts`                                 | retain      | Schema definitions can remain for gated responses/tests.                                     |
| `apps/api/src/worker/routes/drama-process-validation-fallback.ts`              | gate        | Fallback exists for process validation only; should not power customer-facing drama launch.  |
| `apps/api/src/worker/services/dramas-factory.ts`                               | retain      | Service factory can remain for rollback/reference while public routes are gated.             |
| Drama imports/wiring in `apps/api/src/worker.ts`                               | gate        | Route registration should follow product-mode decisions in implementation tickets.           |

## Admin routes and DTOs

| Artifact                                                                                                              | Disposition | Rationale / follow-up note                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| Admin `/admin/dramas` controller/service paths (`apps/api/src/modules/admin/admin.controller.ts`, `admin.service.ts`) | gate        | Admin drama management should be unavailable in novels-only mode unless explicitly retained for audit. |
| `apps/api/src/modules/admin/dto/drama.dto.ts`                                                                         | retain      | DTOs can remain while admin drama endpoints are gated.                                                 |
| `apps/api/src/modules/admin/dto/drama.types.ts`                                                                       | retain      | Type definitions can remain for rollback/reference.                                                    |
| Admin drama tests (`admin.service.spec.ts`, `dto/drama.dto.spec.ts`)                                                  | retain      | Keep or quarantine tests depending on later product-mode helper behavior.                              |

## Database/schema/data

| Artifact                                                                                      | Disposition   | Rationale / follow-up note                                                                                    |
| --------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| Prisma drama models/tables in `packages/db/prisma/schema.prisma`                              | propose-later | Do not drop schema/tables in this wave; requires separate DB/data/schema proposal gate.                       |
| Migration `packages/db/prisma/migrations/20260510000000_add_short_drama_domain/migration.sql` | retain        | Historical migration must remain immutable.                                                                   |
| Drama seed data in `packages/db/prisma/seed.mjs`                                              | gate          | Seed behavior should not make drama active by default in novels-only development unless explicitly requested. |
| `packages/db/prisma/staging-suspense-1913.seed.mjs`                                           | retain        | Staging fixture seed is reference/test material, not active launch data.                                      |
| `packages/db/prisma/production-suspense-1913.seed.mjs`                                        | propose-later | Production drama seed path must not run without a separate approval gate.                                     |
| `packages/db/prisma/staging-suspense-1913.seed.test.mjs`                                      | retain        | Retain as evidence for seed behavior while quarantined.                                                       |

## Tests, scripts, and fixtures

| Artifact                                    | Disposition | Rationale / follow-up note                                                             |
| ------------------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `tests/e2e/specs/drama-regression.spec.ts`  | retain      | Keep as quarantined regression coverage; later ticket may skip/gate under novels mode. |
| `tests/e2e/fixtures/drama.ts`               | retain      | Fixture supports quarantined tests.                                                    |
| `packages/shared/src/drama-e2e-fixtures.ts` | retain      | Shared deterministic data supports tests and fallback validation.                      |
| `scripts/smoke.sh` drama checks             | gate        | Production smoke should not require drama endpoints for novels-only launch.            |
| `scripts/smoke.test.sh` drama cases         | retain      | Keep script self-tests, updating expectations only in implementation tickets.          |
| `docs/staging-drama-pack-suspense-1913.md`  | retain      | Operational history/reference; not part of active launch path.                         |
| `docs/phase3-short-drama-*.md`              | retain      | Historical planning/spec docs; superseded by ADR 0001 for active direction.            |
| `docs/adr/drama-*.md`                       | retain      | Prior ADRs remain historical context; superseded for current launch by ADR 0001.       |

## Media/assets

| Artifact                                              | Disposition   | Rationale / follow-up note                                                                     |
| ----------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| HLS URLs and poster URLs in drama fixtures            | retain        | Test/demo references only; do not delete media in this wave.                                   |
| Cloudflare R2 drama media packs                       | propose-later | No bucket deletion/rewrite under #196; handle only under a future approved media cleanup plan. |
| Drama thumbnails/posters referenced by seeds/fixtures | propose-later | Preserve until data/media inventory confirms ownership and rollback requirements.              |

## Hard stops for quarantine work

- Do not drop drama database tables or edit applied migrations.
- Do not delete production or staging R2 media.
- Do not mutate Stripe live products/prices, secrets, DNS, domains, certificates, or CDN configuration.
- Do not perform production cutover solely from this register.
