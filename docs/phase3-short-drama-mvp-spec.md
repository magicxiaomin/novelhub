# NovelHub Phase 3 Spec — Short Drama MVP

Status: DRAFT FOR HUMAN APPROVAL  
Owner: NovelHub Orchestrator  
Created: 2026-05-10  
Entry handoff: GitHub Issue #127, `docs/handoff-2026-05-10.md`, `docs/operations.md`

## Decision summary

NovelHub Phase 1/2 infrastructure and Cloudflare cutover are complete. Phase 3 shifts from infrastructure to product development: a short-drama / vertical-drama MVP.

The user selected video pipeline option **C: external HLS / mock video URL first**. This means Phase 3 should validate the short-drama product loop before building an upload/transcoding pipeline.

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

- Drama-first homepage or entry section.
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

- first N episodes are free;
- paid episodes require either active subscription or coin unlock;
- default pricing may mirror `Book.coinPerChapter` as `Drama.coinPerEpisode`, subject to human approval.

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

## Required human decisions before implementation

Implementation should not start until the user approves the following:

1. Content source for the first alpha set: mock/demo, licensed, self-produced, or external sample.
2. Whether `dramavela.com` homepage becomes drama-first immediately or keeps novels as the top experience until alpha is ready.
3. Default free episode count and coin price per episode.
4. Whether novel remains accessible as a tab/secondary route during Phase 3.
5. Whether mock/external HLS URLs may be stored directly in production DB for alpha.
6. Whether schema changes are approved for Phase 3.

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
