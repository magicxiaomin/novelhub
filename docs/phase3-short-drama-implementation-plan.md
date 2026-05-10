# Phase 3 Short Drama MVP — Implementation Plan

Status: READY FOR HUMAN APPROVAL  
Date: 2026-05-10  
Parent Epic: #128  
Related PR: #133

## Final product decisions

- Content source: demo/mock content first.
- Video pipeline: external/mock HLS URL first; no upload/transcoding/Cloudflare Stream in MVP.
- Primary domain: `dramavela.com` / `www.dramavela.com` show the short-drama experience.
- Novel domain: `novel.dramavela.com` preserves the existing novel experience.
- Pricing defaults: first 3 episodes free; paid episodes cost 5 coins each; active subscriptions bypass the episode paywall.
- Data model: add `Drama`, `Episode`, `VideoAsset`, `EpisodeUnlock`, `WatchProgress`; do not reuse `Book`/`Chapter` for video content.
- Migration strategy: additive Prisma migration only; do not modify/delete existing migrations or novel tables.

## Final MVP scope

The MVP product loop is:

1. browse short dramas;
2. open drama detail;
3. play a free vertical episode;
4. hit a paywall on a paid episode;
5. log in and unlock with coins or bypass with subscription;
6. resume playback later;
7. manage drama/episode metadata and external playback URLs in admin.

## Non-goals

Phase 3 does not include:

- formal operations launch;
- paid ads / SEO launch / newsletter / KOL / social campaign;
- Stripe Live mode;
- production rollback automation changes;
- video upload, transcoding, ffmpeg, Cloudflare Stream, R2 HLS segment management;
- DRM, signed playback URLs, advanced anti-piracy;
- recommendations, comments, danmaku, social features;
- native iOS/Android app;
- deleting or rewriting the novel experience.

## Acceptance criteria

### Data / Schema

- New tables support `Drama`, `Episode`, `VideoAsset`, `EpisodeUnlock`, `WatchProgress`.
- `Drama.freeEpisodeCount` defaults to 3 and `Drama.coinPerEpisode` defaults to 5.
- `VideoAsset.provider` exists from day one and defaults to `external_hls`.
- `VideoAsset` is 1:1 with `Episode` in MVP.
- `WatchProgress` supports logged-in users and guests.
- Existing `Book`, `Chapter`, `ChapterUnlock`, `ReadingProgress`, and existing migrations remain untouched.

### API

- `GET /api/dramas` lists published dramas with pagination/filter support.
- `GET /api/dramas/:id` returns drama detail, episodes, access status, and resume data.
- `GET /api/episodes/:id/playback` returns playback data only when access is granted; locked paid episodes return a paywall response.
- `POST /api/episodes/:id/unlock` is idempotent and atomically performs coin debit, unlock write, and coin transaction write.
- `PUT /api/watch-progress` upserts watch progress for user or guest.
- Admin APIs support drama, episode, and video-asset metadata management behind existing admin auth.

### Web

- Primary domain renders drama-first experience.
- `novel.dramavela.com` preserves the existing novel experience.
- Drama detail page shows free/paid state and episode list.
- 9:16 vertical player supports HLS playback, pause/progress, paywall, unlock, and resume.
- Subscription users do not see paywall for paid episodes.

### QA

- New e2e covers browse → play free episode → locked paid episode → login/unlock → resume playback.
- New tests cover coin unlock idempotency and insufficient-balance behavior.
- Existing novel smoke/e2e remains green.
- No production secrets or Stripe Live settings are touched.

## Implementation issue split

Create implementation issues only after #132 human approval.

| Issue     | Title                                     | Scope                                                            | Dependencies                    |
| --------- | ----------------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| DRAMA-010 | Schema & migration for short-drama domain | Add Prisma models/tables, indexes, defaults, mock seed strategy  | #132                            |
| DRAMA-011 | Public drama API                          | `GET /api/dramas`, `GET /api/dramas/:id`                         | DRAMA-010                       |
| DRAMA-012 | Episode playback API                      | playback access decision, paywall response, provider abstraction | DRAMA-010, DRAMA-011            |
| DRAMA-013 | Episode unlock API                        | coin/subscription unlock, idempotency, coin transaction          | DRAMA-010, DRAMA-012            |
| DRAMA-014 | Watch progress API                        | user/guest progress upsert and continue-watching                 | DRAMA-010, DRAMA-012            |
| DRAMA-015 | Admin drama/episode/video metadata        | CRUD + publish/unpublish + external URL validation               | DRAMA-010                       |
| DRAMA-016 | Web domain routing                        | primary drama surface and novel subdomain preservation           | DRAMA-011                       |
| DRAMA-017 | Drama browse/detail UI                    | homepage rails, detail page, episode list                        | DRAMA-011, DRAMA-016            |
| DRAMA-018 | Vertical player + paywall UI              | HLS playback, paywall, unlock flow, resume                       | DRAMA-012, DRAMA-013, DRAMA-014 |
| DRAMA-019 | Drama e2e and regression smoke            | full product loop + existing novel regression                    | DRAMA-015, DRAMA-018            |

## Technical recommendations

### Data model details

- `Drama.slug` should be unique and effectively immutable.
- `Drama.status` should reuse existing status vocabulary where possible: `ONGOING`, `COMPLETED`, `HIATUS`.
- `Drama.publishedAt` controls public visibility; `deletedAt` remains soft-delete.
- `Episode` should have unique `(dramaId, order)`.
- `VideoAsset.episodeId` should be unique.
- `EpisodeUnlock` should have unique `(userId, episodeId)` for idempotency.
- `WatchProgress` should mirror `ReadingProgress` semantics with unique `(userId, episodeId)` and `(guestId, episodeId)`.

### Video pipeline details

- `hlsUrl` must be HTTPS.
- External URLs must not contain third-party credentials, cookies, or bearer tokens.
- API must not proxy HLS playlists or segments through the Worker.
- API should only return `hlsUrl` after access is granted.
- Player should use native HLS on iOS Safari and dynamically import `hls.js` elsewhere.
- Client should throttle progress writes.

### Domain/auth details

- Prefer shared auth cookie scope `Domain=.dramavela.com; SameSite=Lax` so `dramavela.com` and `novel.dramavela.com` can share login/subscription state.
- If implementation discovers this conflicts with existing auth/CORS behavior, stop and raise a targeted approval question before changing auth semantics.

## Remaining approval gate

#132 remains the required human gate before implementation. The gate should approve:

- this implementation plan;
- the external/mock HLS ADR;
- the drama data model ADR;
- additive schema changes;
- creating DRAMA-010+ implementation issues.

No merge to `main` and no implementation dispatch should happen until the user explicitly approves the gate.
