# NovelHub Phase 3 Spec — Short Drama MVP

> Superseded for active launch direction (#219): this short-drama artifact is retained only as historical/reference material after the novels-only pivot (#195/#204) and the drama cutoff/removal sequence (#215-#218). Do not use it to launch, seed, QA, or configure active drama surfaces. True-delete/data/media/schema/live DNS/domain/cert/CDN/secrets/R2/DB teardown is out of scope here and tracked separately by #220 / `docs/pivot/drama-true-delete-runbook.md`.

Status: READY FOR HUMAN APPROVAL — DRAMA-006 revised
Owner: NovelHub Orchestrator / requirements
Created: 2026-05-10
Task: GitHub #129 / DRAMA-001
Entry handoff: GitHub Issue #127, `docs/handoff-2026-05-10.md`, `docs/operations.md`
Related ADRs: `docs/adr/drama-video-pipeline.md`, `docs/adr/drama-data-model.md`, `docs/adr/drama-phase3-feasibility-resolution.md`

> Approval gate: this document is requirements only. Do not begin implementation until the human product owner approves #132. DRAMA-006 feasibility revisions are incorporated here; DRAMA-010+ implementation issues should be created only after #132 approval.

## 1. Restated requirement

NovelHub Phase 3 should validate a short-drama / vertical-drama product loop on Dramavela without first building a video upload, transcoding, DRM, or Cloudflare Stream pipeline.

The MVP should let an alpha user:

1. browse a drama-first entry surface;
2. open a drama detail page;
3. play free vertical video episodes from external/mock HLS URLs;
4. encounter episode-level locked states after the configured free episode count;
5. log in and unlock paid episodes through the existing subscription/coin model;
6. resume video watch progress;
7. let admin users create/manage drama and episode metadata and bind external/mock playback URLs.

The user selected video pipeline option C: **external/mock HLS URL first**. The goal is to validate product, commerce, and data-model fit before investing in first-party video infrastructure.

## 2. Resolved decisions and remaining gates

The user approved autonomous PM defaults except where a true product decision is required. Current Phase 3 decisions are:

| ID  | Decision                                  | Resolution                                                                                                                                                        |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | First alpha content source                | Demo/mock content first.                                                                                                                                          |
| Q2  | Domain/product positioning                | `dramavela.com` and `www.dramavela.com` are drama-primary; `novel.dramavela.com` preserves the existing novel experience.                                         |
| Q3  | Default free episodes                     | 3 free episodes per drama by default.                                                                                                                             |
| Q4  | Default paid episode price                | 5 coins per paid episode by default.                                                                                                                              |
| Q5  | Subscription access                       | Active subscriptions bypass paid episode locks.                                                                                                                   |
| Q6  | External/mock HLS in DB                   | Allowed for alpha validation; not the final production video pipeline.                                                                                            |
| Q7  | Anonymous playback                        | Anonymous users may watch free episodes.                                                                                                                          |
| Q8  | Guest watch progress                      | Support guest progress using the same guest-id pattern as the existing product where feasible; otherwise browser-local fallback is acceptable for the first pass. |
| Q9  | Admin                                     | Minimal admin CRUD is in scope because this MVP requires non-engineer metadata/url management.                                                                    |
| Q10 | Social/captions/recommendations/age gates | Out of scope unless separately approved.                                                                                                                          |

Remaining gate: #132 human approval to create and dispatch DRAMA-010+ implementation issues. Merge to `main` also remains a human approval gate. The human approval must explicitly include the DRAMA-006 revisions: resource-rooted Worker API paths, Cloudflare Pages domain routing, shared-cookie/CORS gate, HLS allowlist policy, Worker/Hono target runtime, schema invariants, and revised task dependencies.

## 3. Scope and non-goals

### In scope

- Short-drama content domain alongside, not replacing, the novel domain.
- Drama browse surface and/or homepage section.
- Drama detail page with metadata and ordered episode list.
- Vertical 9:16 episode player using external/mock HLS (`.m3u8`) URLs.
- Free, locked, subscription-unlocked, and coin-unlocked episode states.
- Login-required paid unlock flow using existing user, subscription, order, coin transaction, and payment primitives.
- Watch progress save/resume for authenticated users.
- Minimal admin CRUD for dramas, episodes, publish state, free/paid state, poster URL, and external/mock HLS URL binding.
- Tests/smoke coverage proving the new drama flow does not regress the existing novel flow.

### Explicit non-goals

- Video upload UI.
- ffmpeg/transcoding workers.
- Cloudflare Stream integration.
- R2 HLS segment storage/management.
- DRM, signed video manifests, tokenized playback, or advanced anti-piracy.
- Formal operations launch, paid ads/growth campaign, SEO launch push, social/KOL/newsletter launch.
- Stripe Live mode.
- Native iOS/Android apps.
- Recommendation algorithm.
- Comments, danmaku, social feeds, creator portal, or moderation workflow.
- Deleting, rewriting, or hiding the novel domain without separate human approval.

## 4. User stories

### Viewer

- As a visitor, I can discover short dramas from the main experience so I can try the new vertical.
- As a viewer, I can open a drama detail page and understand the story, poster, episode count, and available episodes.
- As a viewer, I can play free episodes in a mobile-first vertical player.
- As a viewer, I can clearly see which episodes are free and which are locked.
- As a logged-in user, I can unlock a paid episode with coins when I do not have an active subscription.
- As a subscriber, I can play paid episodes without spending coins if my subscription state grants access.
- As a logged-in viewer, I can leave and return later and resume near my last playback position.
- As a viewer, I see a useful retry/error state if an external HLS URL fails.

### Admin

- As an admin, I can create and edit a drama series record.
- As an admin, I can create and edit ordered episodes under a drama.
- As an admin, I can paste an external/mock HLS URL and poster URL for each episode without uploading video files.
- As an admin, I can mark dramas and episodes as draft/published and free/paid so unfinished or locked content does not leak.

### Operator / reviewer

- As a reviewer, I can run smoke/e2e checks proving existing novel browse/read/unlock paths remain green.
- As a reviewer, I can inspect tests proving the drama browse → free playback → paid unlock → resume path works with fixture HLS data.

## 5. Acceptance criteria

### 5.1 Content and data model

- AC-1: Schema direction supports separate `Drama`, `Episode`, `VideoAsset`, `EpisodeUnlock`, and `WatchProgress` concepts rather than reusing `Book`/`Chapter` for video.
- AC-2: Existing novel tables and migrations are not deleted or rewritten; any schema work is append-only via Prisma Migrate.
- AC-3: `Drama` supports at minimum title, slug, synopsis, poster/banner metadata, status, free episode count, coin price per episode, ordering/featured metadata, timestamps, and soft delete strategy consistent with existing content tables.
- AC-4: `Episode` supports at minimum drama relation, episode number/order, title, duration, free/paid state, publish state, timestamps, and soft delete strategy.
- AC-5: `VideoAsset` supports provider abstraction with `external_hls` for MVP, HLS URL, poster URL, playback status, duration/aspect-ratio metadata where available, and future provider-specific migration room.
- AC-6: `EpisodeUnlock` records user/episode paid access and can distinguish subscription-granted access from coin unlock where needed for auditability.
- AC-7: `WatchProgress` stores authenticated user playback position by episode and supports continue-watching at the drama level.

### 5.2 Public API

- AC-8: API can list published dramas with pagination and basic filters/sorting suitable for the drama browse surface.
- AC-9: API can return a published drama detail payload with ordered episode metadata and per-user access/progress state when authenticated.
- AC-10: API can return playback metadata for a free or unlocked episode, including external/mock HLS URL and poster URL.
- AC-11: API does not return playable HLS metadata for a locked episode unless the user has access.
- AC-12: API can unlock a paid episode with coins using an atomic transaction that updates coin balance and writes a `CoinTransaction` plus `EpisodeUnlock` record.
- AC-13: API treats active subscription as access-granting for paid episodes if Q5 is approved.
- AC-14: API can save and retrieve watch progress; progress writes are idempotent and throttling-safe.
- AC-15: Public endpoints follow existing auth, validation, DTO, OpenAPI, and rate-limit conventions.

### 5.3 Web UX

- AC-16: Web provides a drama entry surface from the main product experience without removing access to novels.
- AC-17: Drama browse renders mobile-first cards with poster, title, and key metadata.
- AC-18: Drama detail renders synopsis, episode list, free/locked states, and continue-watching CTA when progress exists.
- AC-19: Player page is optimized for vertical video and supports play/pause, seek, mute/volume, fullscreen, loading, retry, and error states.
- AC-20: Free episodes play for anonymous and logged-in users, subject to normal public content rules.
- AC-21: Locked episodes show a paywall/unlock prompt rather than failing silently.
- AC-22: Logged-in users can unlock a paid episode and immediately play it after successful unlock.
- AC-23: Watch progress resumes within an acceptable tolerance of the last saved position after leaving and returning.
- AC-24: User-facing strings are localization-ready and follow existing web i18n conventions.

### 5.4 Admin

- AC-25: Admin can create/edit/list dramas.
- AC-26: Admin can create/edit/list episodes under a drama.
- AC-27: Admin can bind or update external/mock HLS URL and poster URL for an episode.
- AC-28: Admin can set free/paid state and publish/unpublish state.
- AC-29: Unpublished dramas/episodes are excluded from public browse/detail/playback APIs.
- AC-30: Admin inputs validate URL shape and required metadata; invalid HLS/poster URLs are rejected or clearly marked invalid.

### 5.5 Tests and regression gates

- AC-31: New drama e2e covers browse → play free episode → encounter locked episode → unlock paid episode → resume playback.
- AC-32: Backend tests cover access rules: free episode, active subscription, prior episode unlock, insufficient coins, and anonymous locked access denial.
- AC-33: Existing novel smoke/e2e remains green.
- AC-34: Fixture/mock HLS data is deterministic enough for CI and local development.
- AC-35: Production operations launch remains deferred until explicit post-development approval.

## 6. UX implications

- Product navigation must decide whether drama is the default homepage experience or a prominent secondary section.
- Drama detail and player should be mobile-first because short drama is primarily consumed in vertical format.
- Locked episode UX should reuse existing paywall concepts where possible so users understand subscription/coin access.
- The player needs explicit external-stream failure states because upstream HLS reliability is outside NovelHub control.
- Continue-watching should prioritize the last watched drama/episode for authenticated users.
- Novels should remain reachable until a separate human decision approves a drama-first replacement strategy.

## 7. API implications

Final REST surface must match current repository conventions: backend routes are resource-rooted. Do not document or implement `/api` as part of the Worker contract unless a later Pages routing PR explicitly adds a frontend proxy. The frontend may still use a Next/Pages `/api/*` rewrite internally, but backend docs, Worker tests, and API clients should target `NEXT_PUBLIC_API_BASE_URL` plus these resource paths:

- `GET /dramas` — list published dramas.
- `GET /dramas/:slug` — drama detail and ordered episode metadata.
- `GET /dramas/:slug/episodes/:episodeNumber/playback` or `GET /episodes/:id/playback` — playback metadata if free/unlocked/subscription-accessible.
- `POST /dramas/:slug/episodes/:episodeNumber/unlock` or `POST /episodes/:id/unlock` — idempotent coin unlock.
- `GET /me/drama-progress` or scoped equivalent — continue watching state.
- `PUT /episodes/:id/progress` or `POST /drama-progress` — throttling-safe progress upsert.
- Admin-only drama CRUD under `/admin/dramas...`.
- Admin-only episode/video URL management under `/admin/dramas/:dramaId/episodes...` or `/admin/episodes/:episodeId/video-asset`.

Security/access implications:

- Public list/detail may be anonymous, but locked playback metadata and coin unlock require auth.
- Do not expose paid episode HLS URLs before access is granted.
- Coin unlock must follow existing atomic coin transaction rules.
- External HLS URLs are consumed by the browser in MVP; backend should not proxy video bytes unless a later ADR changes that.

### 7.1 Runtime, domain, auth, and HLS gates from DRAMA-006

- New short-drama APIs target the Cloudflare Worker/Hono runtime for MVP. Do not build parallel Nest drama controllers unless a later approved parity task requires it. Existing Nest/novel modules remain untouched.
- `dramavela.com` and `www.dramavela.com` are drama-first. `novel.dramavela.com` preserves the existing novel experience. Use Cloudflare Pages routing/build variants rather than introducing new host middleware in this MVP plan.
- Cross-subdomain sessions require a pre-frontend auth/CORS gate: cookie `Domain=.dramavela.com; Path=/; Secure; HttpOnly; SameSite=Lax`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`, and `CORS_EXTRA_ORIGINS` must be validated for apex, www, novel subdomain, preview, and local dev behavior.
- Production alpha external HLS URLs must be HTTPS, host-allowlisted via `HLS_ALLOWED_HOSTS`, free of userinfo and credential/token-like query strings, and validated for browser CORS/playability. CI must use a deterministic fixture `.m3u8`; no third-party HLS availability should be required for CI.

## 8. Data implications

Proposal v1 confirms the ADR direction: do not reuse `Book`/`Chapter` for short drama. Add new video-specific content/playback tables and reuse account/commerce tables.

Expected relationships and invariants:

- `Drama` has many `Episode` records and has a unique, non-null `slug` used by public detail routes.
- `Episode` has one MVP `VideoAsset`; `VideoAsset.episodeId` is unique.
- `User` has explicit `episodeUnlocks` and `watchProgress` relation fields.
- `EpisodeUnlock` records user/episode paid or subscription access; unique non-null actor/episode behavior must make unlock writes idempotent.
- `WatchProgress` stores user or guest playback position; continue-watching queries need indexes by actor and `lastWatchedAt`.
- `CoinTransaction` records coin spend for episode unlocks.
- Existing `Subscription` state grants access to paid episodes if approved.
- `Drama.totalEpisodes`, if stored, is a derived/cache value maintained transactionally from episode mutations, not an admin-authored source of truth.
- `EpisodeUnlock` and `WatchProgress` require a CHECK-equivalent invariant: exactly one of `userId` or `guestId` is set. Because Prisma does not model CHECK constraints portably, enforce this in service validation and add raw SQL partial unique indexes in the migration where PostgreSQL supports them.

Data approval gates:

- Human must approve new schema direction before Prisma migration work begins.
- Human must approve whether production alpha may store external/mock HLS URLs directly.
- Human must approve default `freeEpisodeCount` and `coinPerEpisode`.
- ADR `docs/adr/drama-data-model.md` should be updated or accepted as the schema source of truth before implementation tickets are cut.

## 9. Risks and mitigations

| Risk                                                                    | Impact                                                     | Mitigation / decision needed                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| External HLS URLs fail, rate-limit, or have CORS issues                 | Playback blocked despite app being healthy                 | Validate URLs in admin; use deterministic fixture HLS for CI; show clear retry/error states.             |
| Storing direct HLS URLs leaks paid content after first authorized fetch | Weak anti-piracy in MVP                                    | Accept as alpha limitation or require a redirect/signing design before implementation.                   |
| Paywall semantics diverge from chapter unlock semantics                 | User confusion and duplicate logic                         | Mirror existing free/subscription/prior unlock/coin purchase rules unless approved otherwise.            |
| Video fields pollute novel schema if tables are reused                  | Long-term schema fragility                                 | Keep drama/video tables separate.                                                                        |
| Watch progress writes are too frequent                                  | Backend load and noisy data                                | Client throttle/debounce; save on interval plus pause/exit; feasibility review should choose thresholds. |
| Admin URL entry enables bad or unsafe URLs                              | Broken UX or security concerns                             | Validate URL scheme/host policy; restrict production URLs to approved sources if needed.                 |
| Drama-first homepage may harm existing novel users                      | Product/monetization regression                            | Keep novels accessible; require explicit homepage positioning approval.                                  |
| Stripe is deliberately unconfigured/test-only                           | Paid unlock checkout may not work end-to-end in production | Coin unlock can use existing balances in alpha; do not enable Stripe Live without separate approval.     |

## 10. Decisions resolved; approval still required

The previously open product questions have been resolved as follows:

1. MVP scope approved for planning: browse, detail, external/mock HLS playback, paywall/unlock, progress, admin metadata/url management.
2. Alpha content source: demo/mock.
3. Homepage/domain positioning: drama on `dramavela.com`/`www`, novel on `novel.dramavela.com`.
4. Novels remain accessible during Phase 3.
5. Default free episode count: 3.
6. Default coin price: 5 coins per paid episode.
7. Active subscription unlocks paid drama episodes.
8. External/mock HLS URLs may be stored for alpha validation.
9. Direct HLS URLs are acceptable for MVP, but should only be returned from playback APIs after access is granted.
10. `VideoAsset` is 1:1 with `Episode` for MVP.
11. Guest watch progress should use a server-side guest identifier if it fits existing patterns; otherwise browser-local fallback is acceptable for the first pass.
12. Admin starts as minimal CRUD plus external URL binding; no upload/transcoding.

Remaining approvals before implementation:

- Approve #132 human gate.
- Approve additive schema PR when DRAMA-010 is produced.
- Approve merge of PR #133 or any future implementation PR.

## 11. Proposal v1 for Codex feasibility review

### Proposed implementation sequence after human approval

See also `docs/phase3-short-drama-implementation-plan.md` for the finalized DRAMA-010+ split.

1. DRAMA-002: confirm external/mock HLS pipeline ADR and direct-url constraints.
2. DRAMA-003: confirm data model ADR and schema migration shape.
3. DRAMA-004: record human approval gate for scope, defaults, and production external URL allowance.
4. DRAMA-010: schema and seed/fixture data for drama, episode, video asset, unlock, progress.
5. DRAMA-011: public drama list/detail/playback APIs.
6. DRAMA-012: coin/subscription access and episode unlock APIs.
7. DRAMA-013: watch progress APIs.
8. DRAMA-014: web browse/detail/player UX.
9. DRAMA-015: admin drama/episode/video URL management.
10. DRAMA-016: e2e, regression smoke, and documentation updates.

### Questions for Codex feasibility review

- Does the proposed REST/API surface fit the current NestJS module conventions?
- Should playback return direct `hlsUrl`, or should MVP introduce an indirection endpoint to prepare for future signed/private playback?
- Is `VideoAsset` 1:1 with `Episode` sufficient for MVP, or should multiple assets/renditions be modeled immediately?
- How should watch progress throttling be implemented to avoid excessive writes while preserving resume accuracy?
- Can existing chapter unlock and coin transaction patterns be reused cleanly without introducing polymorphic content abstractions?
- What is the smallest admin implementation that satisfies AC-25 through AC-30 without overbuilding?
- What deterministic HLS fixture strategy should be used for local/CI tests?
- Are there hidden Cloudflare Worker, CORS, or browser-player constraints that require a spike before estimation?

### Feasibility review output expected

Codex should return:

- feasibility verdict for each major scope area;
- recommended implementation ticket order;
- risks that require spikes;
- schema/API adjustments before approval;
- any acceptance criteria that are too broad, missing, or not testable.

## 12. Guardrails

- Do not implement code from this requirements task.
- Do not touch production secrets.
- Do not enable Stripe Live mode.
- Do not delete or rewrite existing novel tables.
- Do not modify existing migrations; append only after approval.
- Do not start formal launch/ops/growth activities in Phase 3 product development.
- Do not build upload/transcoding until a later video-pipeline phase is approved.
- Do not hide/remove the novel experience without explicit approval.

## 13. Approval checklist

Human product owner should answer or approve:

- [ ] Q1 content source.
- [ ] Q2 homepage positioning.
- [ ] Q3 free episode count.
- [ ] Q4 coin price per episode.
- [ ] Q5 subscription access semantics.
- [ ] Q6 production storage of external/mock HLS URLs.
- [ ] Q7 anonymous free playback.
- [ ] Q8 guest progress behavior.
- [ ] Q9 admin UI vs seed/import scope.
- [ ] Q10 captions/social/age-gate exclusion.
- [ ] AC-1 through AC-35 are accepted as DRAMA-001 requirements.
- [ ] Proposal v1 may proceed to Codex feasibility review.
