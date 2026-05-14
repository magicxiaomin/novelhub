# ADR: Phase 3 Drama Data Model

> Superseded for active launch direction (#219): this short-drama artifact is retained only as historical/reference material after the novels-only pivot (#195/#204) and the drama cutoff/removal sequence (#215-#218). Do not use it to launch, seed, QA, or configure active drama surfaces. True-delete/data/media/schema/live DNS/domain/cert/CDN/secrets/R2/DB teardown is out of scope here and tracked separately by #220 / `docs/pivot/drama-true-delete-runbook.md`.

Status: DRAFT FOR HUMAN APPROVAL — DRAMA-006 revised
Date: 2026-05-10
Related spec: `docs/phase3-short-drama-mvp-spec.md`
Related resolution: `docs/adr/drama-phase3-feasibility-resolution.md`

## Context

The current NovelHub data model is web-novel oriented:

- `Book`
- `Chapter`
- `ChapterUnlock`
- `ReadingProgress`

`Chapter.contentUrl` points to text content, and `ReadingProgress.scrollPosition` is scroll-based. Short drama requires video-specific metadata and time-based progress.

## Decision

Add a new short-drama content domain instead of reusing `Book`/`Chapter`.

Proposed conceptual models:

- `Drama`
- `Episode`
- `VideoAsset`
- `EpisodeUnlock`
- `WatchProgress`

Reuse account and commerce models:

- `User`
- `Subscription`
- `Order`
- `CoinTransaction`
- `WebhookEvent`
- `FbEvent`

## Rationale

Do not force videos into the existing novel schema because:

- `Chapter.wordCount` does not apply to videos;
- videos require `durationSec`, aspect ratio, poster, playback provider, and playback status;
- text `contentUrl` differs from HLS/video playback metadata;
- scroll-based reading progress differs from millisecond-based watch progress;
- mixing domains would introduce many nullable fields and fragile conditionals.

Keeping domains separate improves clarity and makes it easier to preserve the existing novel business while adding short drama.

## Initial model sketch

This is intentionally a draft; implementation requires a separate schema approval gate.

### Drama

- `id`
- `title`
- `slug` (unique, non-null, public detail route key)
- `synopsis`
- `portraitPosterUrl`
- `landscapeBannerUrl`
- `category`
- `tags`
- `totalEpisodes` (derived/cache value, not admin-authored)
- `status`
- `isFeatured`
- `freeEpisodeCount`
- `coinPerEpisode`
- `language`
- `country`
- `releasedAt`
- `createdAt`
- `updatedAt`
- `deletedAt`

### Episode

- `id`
- `dramaId`
- `order` or `episodeNumber` (unique with `dramaId`)
- `title`
- `description`
- `durationSec`
- `isFree`
- `publishedAt`
- `createdAt`
- `updatedAt`
- `deletedAt`

### VideoAsset

- `id`
- `episodeId`
- `provider`
- `hlsUrl`
- `posterUrl`
- `previewUrl`
- `status`
- `width`
- `height`
- `durationSec`
- `metadata`
- `createdAt`
- `updatedAt`

For Phase 3 MVP, provider is expected to be `external_hls`.

### EpisodeUnlock

- `id`
- `userId`
- `episodeId`
- `method` (`coin`, `subscription_grant`, or equivalent audited value)
- `coinTransactionId` where coin spend applies
- `unlockedAt`
- `createdAt`
- `updatedAt`

Semantics mirror `ChapterUnlock`.

### WatchProgress

- `id`
- exactly one of `userId` or `guestId`
- `dramaId`
- `episodeId`
- `lastPositionMs`
- `completed`
- `lastWatchedAt`
- `createdAt`
- `updatedAt`

Semantics mirror `ReadingProgress` but use playback time, not scroll position. Continue-watching queries must be indexed by actor (`userId` or `guestId`) and `lastWatchedAt`.

## DRAMA-006 schema hardening

Implementation must include the following details before schema approval:

- `Drama.slug` is required, unique, and used for public detail URLs. Treat it as effectively immutable after publish unless a redirect strategy is separately approved.
- `User` must define explicit relations for `episodeUnlocks` and `watchProgress` so Prisma schema generation is unambiguous.
- `Drama.totalEpisodes`, if stored, is a derived/cache field maintained transactionally during episode create/delete/publish mutations. Admin requests must not directly set it as the source of truth.
- Browse indexes should cover public visibility and ordering, including slug lookup and published/status/featured/order fields chosen by implementation.
- Continue-watching indexes should cover `(userId, lastWatchedAt)` and `(guestId, lastWatchedAt)` or equivalent actor-specific access paths.
- `EpisodeUnlock` and `WatchProgress` require exactly one actor identifier: `userId` XOR `guestId`. Enforce this in service validation and add PostgreSQL CHECK/partial unique indexes via raw migration SQL where practical, because Prisma cannot portably express every invariant.
- Nullable uniqueness must be explicit: do not rely on a single composite unique containing nullable columns for idempotency. Use separate partial unique indexes such as `(episodeId, userId) WHERE userId IS NOT NULL` and `(episodeId, guestId) WHERE guestId IS NOT NULL` where supported.

## Migration strategy

- Add new tables via a new Prisma migration.
- Do not modify or delete existing migrations.
- Do not delete existing novel tables.
- Keep novels accessible unless a later human-approved product decision changes this.

## Resolved implementation defaults

- `Drama.status` should reuse the existing status vocabulary where possible for MVP: `ONGOING`, `COMPLETED`, `HIATUS`, with publishing controlled by `publishedAt`/`deletedAt` and admin visibility rules.
- Default `freeEpisodeCount`: **3**.
- Default `coinPerEpisode`: **5**.
- External/mock HLS URLs are allowed for alpha validation.
- Admin MVP only needs published/unpublished plus draft via missing `publishedAt`; scheduled publishing can be deferred unless implementation finds it cheap.
- `VideoAsset` should be 1:1 with `Episode` in MVP. Add provider abstraction fields, but do not model multiple renditions/assets until the real video pipeline is selected.

## Remaining questions before implementation

None blocking for planning. Implementation still requires the normal schema migration review gate and PR review.

## Consequences

### Positive

- Clean domain separation.
- Existing novel functionality remains stable.
- Future video provider migration is easier.
- Commerce primitives are reused without premature polymorphic abstractions.

### Negative

- More new API/admin/web surfaces.
- Some logic will duplicate existing chapter/unlock/progress patterns.
- Requires schema migration and e2e coverage before implementation is safe.

## Approval gate

No implementation should begin until the user approves:

- schema direction;
- MVP defaults;
- external/mock URL allowance;
- homepage positioning for drama vs novel.
