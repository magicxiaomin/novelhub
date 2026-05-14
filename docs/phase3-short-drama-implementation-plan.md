# Phase 3 Short Drama MVP — Implementation Plan

> Superseded for active launch direction (#219): this short-drama artifact is retained only as historical/reference material after the novels-only pivot (#195/#204) and the drama cutoff/removal sequence (#215-#218). Do not use it to launch, seed, QA, or configure active drama surfaces. True-delete/data/media/schema/live DNS/domain/cert/CDN/secrets/R2/DB teardown is out of scope here and tracked separately by #220 / `docs/pivot/drama-true-delete-runbook.md`.

Status: READY FOR HUMAN APPROVAL — DRAMA-006 revised
Date: 2026-05-10
Parent Epic: #128
Related PR: #133
Related ADRs: `docs/adr/drama-video-pipeline.md`, `docs/adr/drama-data-model.md`, `docs/adr/drama-phase3-feasibility-resolution.md`

## Final product and architecture decisions

- Content source: demo/mock content first.
- Video pipeline: external/mock HLS URL first; no upload/transcoding/Cloudflare Stream in MVP.
- Primary domain: `dramavela.com` / `www.dramavela.com` show the drama-first experience.
- Novel domain: `novel.dramavela.com` preserves the existing novel experience.
- Domain routing: use Cloudflare Pages routing/build variants from the same repo; do not introduce new host middleware as a prerequisite for MVP.
- Backend target: new drama APIs target Cloudflare Worker/Hono only for MVP. Existing Nest modules remain untouched; no parallel Nest drama controller surface is required.
- Backend path convention: resource-rooted paths (`/dramas`, `/episodes`, `/admin/...`), not `/api/*`. Frontend `/api` rewrites may exist only as a web boundary detail.
- Auth/CORS gate: before full frontend implementation, validate shared cookie `Domain=.dramavela.com`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`, `CORS_EXTRA_ORIGINS`, and cross-subdomain session behavior.
- Pricing defaults: first 3 episodes free; paid episodes cost 5 coins each; active subscriptions bypass the episode paywall.
- Data model: add `Drama`, `Episode`, `VideoAsset`, `EpisodeUnlock`, `WatchProgress`; do not reuse `Book`/`Chapter` for video content.
- Migration strategy: additive Prisma migration only; do not modify/delete existing migrations or novel tables.

## Final MVP scope

The MVP product loop is:

1. browse short dramas;
2. open drama detail;
3. play a free vertical episode from an approved external/mock HLS URL;
4. hit a paywall on a paid episode;
5. log in and unlock with coins or bypass with subscription;
6. resume playback later;
7. manage drama/episode metadata and external playback URLs in admin;
8. preserve the existing novel product at `novel.dramavela.com`.

## Non-goals

Phase 3 does not include formal operations launch, paid ads/SEO/KOL/newsletter launch, Stripe Live mode, production rollback automation changes, video upload, transcoding, ffmpeg, Cloudflare Stream, R2 HLS segment management, DRM, signed playback URLs, advanced anti-piracy, recommendations, comments, danmaku, social features, native apps, or deleting/rewriting the novel experience.

## Acceptance criteria

### Data / Schema

- New tables support `Drama`, `Episode`, `VideoAsset`, `EpisodeUnlock`, `WatchProgress`.
- `Drama.slug` is unique, non-null, and used for public detail routes.
- `Drama.freeEpisodeCount` defaults to 3 and `Drama.coinPerEpisode` defaults to 5.
- `Drama.totalEpisodes`, if stored, is derived from episode count and maintained transactionally during episode mutations; admin cannot directly author it.
- `VideoAsset.provider` exists from day one and defaults to `external_hls`.
- `VideoAsset` is 1:1 with `Episode` in MVP.
- `User` has explicit relation fields for `episodeUnlocks` and `watchProgress`.
- `EpisodeUnlock` and `WatchProgress` support exactly one actor key: `userId` XOR `guestId`; service validation enforces the invariant and raw migration SQL should add PostgreSQL partial unique indexes for non-null actor keys where practical.
- Indexes support public browse (`Drama.slug`, publish/status/featured/order fields, `Episode(dramaId, episodeNumber/order)`) and continue watching (`WatchProgress(userId,lastWatchedAt)`, `WatchProgress(guestId,lastWatchedAt)`).
- Existing `Book`, `Chapter`, `ChapterUnlock`, `ReadingProgress`, and existing migrations remain untouched.

### API

- Worker/Hono is the target runtime for new drama APIs; no new Nest drama controllers are required for MVP.
- Backend contracts are resource-rooted. Required paths use `/dramas`, `/episodes`, `/admin/...`, `/me/...`, or `/drama-progress`; backend docs/tests do not require `/api/dramas`.
- `GET /dramas` lists published dramas with pagination/filter support.
- `GET /dramas/:slug` returns drama detail, episodes, access status, and resume data.
- Playback endpoint returns playback data only when access is granted; locked paid episodes return a paywall/access-denied response without HLS URL.
- Unlock endpoint is idempotent and atomically performs coin debit, unlock write, and coin transaction write.
- Progress endpoint upserts watch progress for user or guest and tolerates throttled client writes.
- Admin APIs support drama, episode, and video-asset metadata management behind existing admin auth.
- Admin HLS URL writes reject production URLs that are not HTTPS, are on hosts outside `HLS_ALLOWED_HOSTS`, include userinfo, or include credential/token-like query parameters.

### Domain / Auth / CORS

- `dramavela.com` and `www.dramavela.com` serve the drama-first variant.
- `novel.dramavela.com` preserves the existing novel variant.
- Both variants use a single Worker API origin via `NEXT_PUBLIC_API_BASE_URL`.
- Shared auth uses `Domain=.dramavela.com; Path=/; Secure; HttpOnly; SameSite=Lax` if the spike validates compatibility.
- Worker credentialed CORS allows only `NEXT_PUBLIC_APP_URL` plus `CORS_EXTRA_ORIGINS`; preview and local origins must be explicit.
- If the auth/CORS spike discovers incompatibility, implementation stops and asks for human approval before changing auth semantics.

### Web

- Primary domain renders drama-first experience without removing access to novels; novel access is preserved through `novel.dramavela.com`.
- Drama detail page shows free/paid state and episode list.
- 9:16 vertical player supports HLS playback, pause/progress, paywall, unlock, retry/error, and resume.
- Subscription users do not see paywall for paid episodes.
- User-facing strings remain localization-ready and follow existing web i18n conventions.

### QA

- New e2e covers browse → play free episode → locked paid episode → login/unlock → resume playback.
- New tests cover coin unlock idempotency and insufficient-balance behavior.
- Existing novel smoke/e2e remains green on `novel.dramavela.com` variant.
- HLS playback tests use a deterministic local/CI `.m3u8` fixture and do not rely on third-party network availability.
- No production secrets or Stripe Live settings are touched.

## Implementation issue split

Create implementation issues only after #132 human approval.

| Issue     | Title                                              | Scope                                                                                                                                                                        | Dependencies                                              |
| --------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| DRAMA-010 | Schema, migration, indexes, and seed fixtures      | Add Prisma models/tables, slug, User relations, partial unique indexes/raw SQL where needed, deterministic drama/episode/video fixture data, totalEpisodes maintenance tests | #132 / DRAMA-006                                          |
| DRAMA-011 | Worker API contracts and public read endpoints     | Finalize resource-rooted contract; implement/list/detail/playback-access read paths; no `/api` backend prefix; no Nest drama controllers                                     | DRAMA-010                                                 |
| DRAMA-012 | Episode unlock and watch progress APIs             | Coin/subscription access, idempotent unlock, coin transaction, user/guest progress upsert/continue-watching                                                                  | DRAMA-010, DRAMA-011                                      |
| DRAMA-013 | Domain routing, shared auth cookie, and CORS spike | Cloudflare Pages variant strategy, `.dramavela.com` cookie, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`, `CORS_EXTRA_ORIGINS`, cross-subdomain smoke                   | DRAMA-006; must finish before DRAMA-016/017 full frontend |
| DRAMA-014 | Admin drama/episode/video metadata APIs            | Admin CRUD + publish/unpublish + HLS allowlist/credential validation                                                                                                         | DRAMA-010, DRAMA-011                                      |
| DRAMA-015 | Admin drama/episode/video UI                       | Admin pages/forms for CRUD and external URL binding                                                                                                                          | DRAMA-014                                                 |
| DRAMA-016 | Drama browse/detail web UX                         | Drama-first variant, catalog/detail pages, episode list, continue-watching CTA                                                                                               | DRAMA-011, DRAMA-013                                      |
| DRAMA-017 | Vertical player, paywall, unlock, and progress UX  | HLS player, paywall, unlock flow, progress throttling/resume                                                                                                                 | DRAMA-012, DRAMA-013, DRAMA-016                           |
| DRAMA-018 | E2E, regression smoke, and docs/runbook            | Full drama product loop, deterministic HLS fixture, existing novel regression, env/domain/HLS runbook updates                                                                | DRAMA-015, DRAMA-017                                      |

## Hermes Kanban task graph

- DRAMA-006 resolves docs and gates #132.
- DRAMA-010 depends on #132 / DRAMA-006.
- DRAMA-011 depends on DRAMA-010.
- DRAMA-012 depends on DRAMA-010 and DRAMA-011.
- DRAMA-013 depends on DRAMA-006 and may run in parallel with DRAMA-010/011, but gates DRAMA-016 and DRAMA-017 full frontend work.
- DRAMA-014 depends on DRAMA-010 and DRAMA-011.
- DRAMA-015 depends on DRAMA-014.
- DRAMA-016 depends on DRAMA-011 and DRAMA-013.
- DRAMA-017 depends on DRAMA-012, DRAMA-013, and DRAMA-016.
- DRAMA-018 depends on DRAMA-015 and DRAMA-017.

Critical path: DRAMA-006 → #132 approval → DRAMA-010 → DRAMA-011 → DRAMA-012 → DRAMA-017 → DRAMA-018.
Parallel path: DRAMA-013 runs after DRAMA-006 and before full frontend work; DRAMA-014/015 can proceed after API/schema foundations.

## PR sequence and human gates

1. Docs PR: DRAMA-006 revisions to spec/ADRs/plan. Human gate: approve #132 before implementation tasks are created or dispatched.
2. Schema PR: DRAMA-010 additive Prisma migration and seeds. Human gate: schema/data-model review.
3. API PR: DRAMA-011/012 Worker contracts, public read, playback/access, unlock, progress. Gate: backend/API contract review.
4. Domain/auth PR: DRAMA-013 Pages routing strategy, cookie/CORS/env rollout. Human/security gate before full frontend work.
5. Admin PRs: DRAMA-014/015 API and UI for metadata/HLS validation. Gate: HLS alpha direct-URL limitation and allowlist accepted.
6. Web PRs: DRAMA-016/017 drama browse/detail/player/unlock/progress. Gate: product/UX review and novel preservation smoke.
7. QA/docs PR: DRAMA-018 e2e/regression/runbook. Gate: CI green and manual staging smoke.
8. Merge to `main`: human approval required.

## Remaining approval gate

#132 remains the required human gate before implementation. The gate should approve this revised implementation plan, the external/mock HLS ADR, the drama data model ADR, the DRAMA-006 feasibility resolution ADR, additive schema direction, domain/auth/CORS strategy, direct external HLS alpha limitation, and creation of DRAMA-010+ implementation issues.

No merge to `main` and no implementation dispatch should happen until the user explicitly approves the gate.
