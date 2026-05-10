# ADR: Phase 3 Drama Data Model

Status: DRAFT FOR HUMAN APPROVAL  
Date: 2026-05-10  
Related spec: `docs/phase3-short-drama-mvp-spec.md`

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
- `synopsis`
- `portraitPosterUrl`
- `landscapeBannerUrl`
- `category`
- `tags`
- `totalEpisodes`
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
- `order`
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
- `method`
- `unlockedAt`
- `createdAt`
- `updatedAt`

Semantics mirror `ChapterUnlock`.

### WatchProgress

- `id`
- `userId` or `guestId`
- `dramaId`
- `episodeId`
- `lastPositionMs`
- `completed`
- `lastWatchedAt`
- `createdAt`
- `updatedAt`

Semantics mirror `ReadingProgress` but use playback time, not scroll position.

## Migration strategy

- Add new tables via a new Prisma migration.
- Do not modify or delete existing migrations.
- Do not delete existing novel tables.
- Keep novels accessible unless a later human-approved product decision changes this.

## Open questions before implementation

1. Should `Drama.status` reuse current book statuses or introduce drama-specific statuses?
2. What are the initial `freeEpisodeCount` and `coinPerEpisode` defaults?
3. Should external/mock HLS URLs be allowed in production DB during alpha?
4. Does admin need draft/scheduled state in MVP, or only published/unpublished?
5. Should `VideoAsset` be 1:1 with episode in MVP, or support multiple assets per episode from day one?

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
