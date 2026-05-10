# NovelHub Phase 3 Spec — Short Drama MVP

Status: DRAFT FOR HUMAN APPROVAL  
Owner: NovelHub Orchestrator  
Created: 2026-05-10  
Entry handoff: GitHub Issue #127, `docs/handoff-2026-05-10.md`, `docs/operations.md`

## Decision summary

NovelHub Phase 1/2 infrastructure and Cloudflare cutover are complete. Phase 3 shifts from infrastructure to product development: a short-drama / vertical-drama MVP.

The user selected video pipeline option **C: external HLS / mock video URL first**. This means Phase 3 should validate the short-drama product loop before building an upload/transcoding pipeline.

Additional user/PM decisions recorded on 2026-05-10:

- Phase 3 alpha content source is **demo/mock content first**.
- Dramavela becomes **drama-primary**.
- Domain routing decides the product surface:
  - `www.dramavela.com` / `dramavela.com`: short drama experience.
  - `novel.dramavela.com`: existing novel experience.
- The reason for the split is to reuse the already-built novel infrastructure while making drama the primary business direction.
- PM default decisions: first 3 episodes free, 5 coins per paid episode, keep subscription bypass, keep novel accessible on the `novel` subdomain, allow external/mock HLS URLs in alpha/staging/prod-like DBs, and approve additive Phase 3 schema changes subject to the normal migration gate.

## Phase 3 goal

Build a minimal short-drama experience that lets an alpha user:

1. browse drama-first content on Dramavela;
2. open a drama detail page;
3. play free vertical episodes from external/mock HLS URLs;
4. hit an episode-level paywall after the configured free episode count;
5. log in and unlock paid episodes using the existing coin/subscription model;
6. resume playback progress;
7. let admin users create/manage drama and episode metadata and bind external playback URLs.

## Explicit non-goals

The following are intentionally skipped until after product development is complete:

- formal operations launch activities;
- paid ads / growth campaign / SEO launch push;
- Stripe Live mode;
- social/KOL/newsletter launch;
- production rollback or release automation changes beyond normal development gates;
- video upload/transcoding pipeline;
- Cloudflare Stream integration;
- DRM or advanced anti-piracy;
- recommendation algorithm;
- comments, danmaku, social features;
- native iOS/Android app.

## MVP scope

### Content domain

Add a short-drama content domain alongside the existing novel domain. Do not delete or rewrite the novel domain.

New conceptual entities:

- `Drama`: a drama series / show.
- `Episode`: one short vertical video episode in a drama.
- `VideoAsset`: playback metadata for an episode. In MVP this points to an external/mock HLS URL and poster URL.
- `EpisodeUnlock`: paid access record for a user and episode.
- `WatchProgress`: playback progress for a user or guest.

### User experience

- Domain-routed product surfaces:
  - `www.dramavela.com` / `dramavela.com` show the short-drama experience.
  - `novel.dramavela.com` shows the existing novel experience.
- Drama-first homepage on the primary domain.
- Drama detail page with episode list.
- Vertical 9:16 player page.
- HLS playback from external/mock URL.
- Episode free/locked states.
- Continue watching support.

### Commerce

Reuse existing user/payment primitives:

- `User`
- `Subscription`
- `Order`
- `CoinTransaction`
- existing Stripe checkout/webhook path, when Stripe is configured
- existing coin balance and unlock semantics

MVP paywall policy:

- first 3 episodes are free by default;
- paid episodes cost 5 coins per episode by default;
- paid episodes require either active subscription or coin unlock;
- pricing fields remain configurable per drama so the defaults can change later without a schema rewrite.

### Admin

Admin MVP should support:

- create/edit/list dramas;
- create/edit/list episodes under a drama;
- bind external/mock playback URL and poster URL to an episode;
- mark episodes free/paid;
- publish/unpublish drama/episode.

No upload/transcoding in Phase 3 MVP.

## Technical direction

### Video pipeline decision

Chosen for MVP: **external/mock HLS URL first**.

Implications:

- store external `hlsUrl` / `posterUrl` in `VideoAsset`;
- no Cloudflare Stream provisioning now;
- no R2 segment upload pipeline now;
- no ffmpeg/transcoding worker now;
- later migration to Cloudflare Stream or R2 HLS should be possible by changing `VideoAsset.provider` and adding provider-specific fields.

### Data model strategy

Do **not** reuse `Book`/`Chapter` for short drama.

Reasoning:

- chapters are text-first and use `contentUrl` for R2 text content;
- episodes need duration, playback URL, poster, provider status, and video-specific progress;
- reading progress is scroll-based, while watch progress is time-based;
- forcing one table to serve both domains would create nullable-field drift and fragile type branches.

Reuse account and commerce tables; add new content/playback tables.

## Decisions before implementation

The following decisions are now recorded:

1. Content source for the first alpha set: **demo/mock content first**.
2. Primary domain behavior: **`www.dramavela.com` / `dramavela.com` show drama**.
3. Novel domain behavior: **`novel.dramavela.com` keeps the existing novel experience available**.
4. Default free episodes: **3**.
5. Default paid episode price: **5 coins per episode**.
6. Mock/external HLS URLs may be stored directly for alpha validation.
7. Additive Phase 3 schema changes are allowed after ADR approval and normal migration review.

Remaining implementation gate: approve this updated spec/ADR set and then create DRAMA-010+ implementation issues.

## Acceptance criteria for Phase 3 MVP

- Schema supports Drama/Episode/VideoAsset/EpisodeUnlock/WatchProgress.
- API supports listing dramas, reading drama detail, retrieving episode playback metadata, unlocking paid episodes, and saving/resuming watch progress.
- Web supports drama browse, detail, vertical player, paywall, unlock, and continue watching.
- Admin supports creating drama/episode records and binding external/mock URLs.
- Existing novel smoke remains green.
- New drama e2e covers browse → play free episode → unlock paid episode → resume playback.
- Production operations launch remains deferred until explicit post-development approval.

## Suggested issue sequence

1. DRAMA-001: Short Drama MVP requirements and acceptance criteria.
2. DRAMA-002: External/mock HLS video pipeline ADR.
3. DRAMA-003: Drama data model ADR.
4. DRAMA-004: Human approval gate for Phase 3 schema/product scope.
5. DRAMA-010+: implementation issues after approval.

## Guardrails

- Do not touch production secrets.
- Do not enable Stripe Live mode.
- Do not delete or rewrite existing novel tables.
- Do not modify existing migrations; append only.
- Do not start formal launch/ops/growth activities in Phase 3 product development.
- Do not build upload/transcoding until a later video-pipeline phase is approved.
