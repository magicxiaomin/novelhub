# Staging drama media pack: Suspense (1913)

> Superseded for active launch direction (#219): this short-drama artifact is retained only as historical/reference material after the novels-only pivot (#195/#204) and the drama cutoff/removal sequence (#215-#218). Do not use it to launch, seed, QA, or configure active drama surfaces. True-delete/data/media/schema/live DNS/domain/cert/CDN/secrets/R2/DB teardown is out of scope here and tracked separately by #220 / `docs/pivot/drama-true-delete-runbook.md`.

Related: GitHub issue #179, parent epic #169, staging data gate #178, Kanban task `t_ccf778c3`.

Status: runbook and staging-only asset plan. Do not upload these assets to production. Do not use licensed, rescored, restored, or colorized variants unless their rights are separately verified and documented.

## Decision

Use four pre-cut, per-episode HLS VOD assets for a single staging drama:

- Drama slug: `suspense-1913`
- Provider: `external_hls`
- Video assets: one `VideoAsset` per `Episode`
- Playback URL shape: `<STAGING_DRAMA_MEDIA_BASE_URL>/dramas/suspense-1913/ep{1..4}/index.m3u8`
- Clip offsets: retained in `VideoAsset.metadata.provenance.clip` for traceability only; the player must not rely on shared progressive WebM clipping.
- Access split: episodes 1 and 2 free; episodes 3 and 4 locked.

This matches the Phase 4 architecture decision: four per-episode HLS assets, no progressive/shared clip enforcement in the player.

## Smoke coverage mapping

This pack is intended to exercise the Phase 4 staging drama smoke flows without touching production data:

| Smoke flow     | Pack coverage                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browse/listing | The `suspense-1913` drama should appear in the staging browse response with four episodes and HLS-backed media metadata.                                                  |
| Detail         | The drama detail view should show the staging title, episode order, free/locked split, and HLS playback URLs for each episode without requiring progressive clip offsets. |
| Player         | Opening any episode should initialize the HLS player from that episode's `index.m3u8` URL under `<STAGING_DRAMA_MEDIA_BASE_URL>/dramas/suspense-1913/ep{n}/`.             |
| Free playback  | Episodes 1 and 2 are free and should play for unauthenticated/eligible smoke users without an unlock purchase.                                                            |
| Locked no-leak | Episodes 3 and 4 are locked; smoke checks should confirm locked responses do not expose playable signed or direct media URLs before entitlement.                          |
| Unlock         | Unlocking a locked episode should grant access only through the reviewed staging entitlement path and then return the episode's HLS URL.                                  |
| Progress       | Watching a free or unlocked episode should update the staging progress endpoint for the correct drama/episode without depending on shared progressive WebM clip offsets.  |

If these fixtures are used by automated smoke tests, keep assertions scoped to
staging identifiers and the access split above: episodes 1-2 free, episodes 3-4
locked.

## Source and license evidence

Primary source:

- Work: `Suspense (1913)`, directed by Lois Weber and Phillips Smalley.
- Wikimedia Commons file page: https://commons.wikimedia.org/wiki/File:Suspense_(1913).webm
- Direct source file URL: https://upload.wikimedia.org/wikipedia/commons/2/28/Suspense_%281913%29.webm
- License evidence on Commons: public domain / `PD-1923`.
- PD-1923 template evidence: https://commons.wikimedia.org/wiki/Template:PD-1923
- Direct source file headers observed during runbook preparation:
  - HTTP status: `200`
  - `content-type: video/webm`
  - `content-length: 61121344`
  - `etag: 564d284cb3228438bab774c8e103d8f8`
  - `last-modified: Sun, 20 Jan 2019 19:33:07 GMT`
- Duration observed with `ffprobe`: `610.276` seconds.

Backup public-domain sources, if the primary source becomes unavailable, are listed in #179. Do not switch sources without updating this document, checksums, metadata provenance, and issue traceability.

## Chosen episode split

The source is about 610.276 seconds. Use contiguous cuts that cover the full source and keep the final clip boundary at source end:

| Episode | Staging title           |          Start |            End | Approx duration | Free? | Asset path                  |
| ------- | ----------------------- | -------------: | -------------: | --------------: | ----- | --------------------------- |
| 1       | Part 1: The Call        | `00:00:00.000` | `00:02:32.500` |          152.5s | yes   | `dramas/suspense-1913/ep1/` |
| 2       | Part 2: The Intruder    | `00:02:32.500` | `00:05:05.000` |          152.5s | yes   | `dramas/suspense-1913/ep2/` |
| 3       | Part 3: The Rescue Race | `00:05:05.000` | `00:07:37.500` |          152.5s | no    | `dramas/suspense-1913/ep3/` |
| 4       | Part 4: The Escape      | `00:07:37.500` | `00:10:10.276` |        152.776s | no    | `dramas/suspense-1913/ep4/` |

The titles are staging labels only. They are not original intertitle claims.

## Staging URL placeholders

T1 findings confirmed the repo has no committed `DRAMA_MEDIA_BASE_URL`, `HLS_BASE_URL`, drama-specific media bucket, or public media bucket environment variable for seed generation. Therefore this runbook uses an explicit placeholder instead of inventing a live URL:

- Required external input: `STAGING_DRAMA_MEDIA_BASE_URL`
- Placeholder value in docs/seed planning: `<STAGING_DRAMA_MEDIA_BASE_URL>`
- Required HLS allowlist if admin APIs write the URLs: add the hostname of `STAGING_DRAMA_MEDIA_BASE_URL` to `HLS_ALLOWED_HOSTS` in staging.

Example only, not an approved target:

```text
https://<staging-media-host>/dramas/suspense-1913/ep1/index.m3u8
```

Do not commit a real staging bucket hostname until DevOps confirms the safe staging-only media origin and host allowlist.

## Local packaging runbook

Prerequisites:

- `ffmpeg` and `ffprobe` installed.
- Scratch directory outside the repo, for example `/tmp/novelhub-suspense-1913-pack`.
- No production bucket credentials in the shell.

Download the exact source file:

```bash
set -euo pipefail
PACK_DIR=/tmp/novelhub-suspense-1913-pack
SOURCE_URL='https://upload.wikimedia.org/wikipedia/commons/2/28/Suspense_%281913%29.webm'
mkdir -p "$PACK_DIR/src" "$PACK_DIR/hls"
curl -L --fail --output "$PACK_DIR/src/suspense-1913.webm" "$SOURCE_URL"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$PACK_DIR/src/suspense-1913.webm"
sha256sum "$PACK_DIR/src/suspense-1913.webm" > "$PACK_DIR/src/SHA256SUMS"
```

Create the four source clips with exact sub-second boundaries by re-encoding the
VP8 source. Do not use `-c copy` for these split points: stream-copy cuts can
snap to nearby keyframes and are therefore not exact for the `00:02:32.500`,
`00:05:05.000`, and `00:07:37.500` boundaries.

```bash
ffmpeg -y -i "$PACK_DIR/src/suspense-1913.webm" -ss 00:00:00.000 -to 00:02:32.500 -c:v libvpx-vp9 -b:v 0 -crf 32 -an "$PACK_DIR/src/ep1.webm"
ffmpeg -y -i "$PACK_DIR/src/suspense-1913.webm" -ss 00:02:32.500 -to 00:05:05.000 -c:v libvpx-vp9 -b:v 0 -crf 32 -an "$PACK_DIR/src/ep2.webm"
ffmpeg -y -i "$PACK_DIR/src/suspense-1913.webm" -ss 00:05:05.000 -to 00:07:37.500 -c:v libvpx-vp9 -b:v 0 -crf 32 -an "$PACK_DIR/src/ep3.webm"
ffmpeg -y -i "$PACK_DIR/src/suspense-1913.webm" -ss 00:07:37.500 -to 00:10:10.276 -c:v libvpx-vp9 -b:v 0 -crf 32 -an "$PACK_DIR/src/ep4.webm"
sha256sum "$PACK_DIR"/src/ep{1,2,3,4}.webm > "$PACK_DIR/src/CLIP_SHA256SUMS"
```

If an operator intentionally chooses faster stream-copy clipping instead, record
that the resulting clips are keyframe-snapped approximations, not exact
sub-second cuts, and update the episode provenance with the observed
`ffprobe` start/end times.

Package each clip as a single-rendition HLS VOD asset. The output layout intentionally mirrors the app's HLS-shaped playback path: `index.m3u8` plus `.ts` segments per episode.

```bash
for ep in 1 2 3 4; do
  mkdir -p "$PACK_DIR/hls/ep${ep}"
  ffmpeg -y \
    -i "$PACK_DIR/src/ep${ep}.webm" \
    -c:v libx264 \
    -profile:v main \
    -level 3.1 \
    -pix_fmt yuv420p \
    -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' \
    -an \
    -f hls \
    -hls_time 6 \
    -hls_playlist_type vod \
    -hls_segment_filename "$PACK_DIR/hls/ep${ep}/seg_%03d.ts" \
    "$PACK_DIR/hls/ep${ep}/index.m3u8"
done
find "$PACK_DIR/hls" -type f -print0 | sort -z | xargs -0 sha256sum > "$PACK_DIR/hls/HLS_SHA256SUMS"
```

Notes:

- The Wikimedia source currently contains a VP8 video stream only (`478x360`) and no audio stream. The command uses `-an` intentionally.
- Keep the generated checksums in the issue evidence or a future generated manifest. Do not leave placeholder checksums in seed data.
- This PR intentionally does not add binary media or generated HLS output to git.

## Upload plan

Upload only to the approved staging media bucket/path after DevOps confirms the safe target:

```text
<staging-media-bucket>/dramas/suspense-1913/ep1/index.m3u8
<staging-media-bucket>/dramas/suspense-1913/ep1/seg_000.ts
...
<staging-media-bucket>/dramas/suspense-1913/ep4/index.m3u8
<staging-media-bucket>/dramas/suspense-1913/ep4/seg_*.ts
```

Required content types:

| Object   | Content-Type                    |
| -------- | ------------------------------- |
| `*.m3u8` | `application/vnd.apple.mpegurl` |
| `*.ts`   | `video/MP2T`                    |

Required cache/CORS behavior for browser playback:

- `GET`, `HEAD`, and `OPTIONS` allowed from the explicit staging web origin.
- `Access-Control-Allow-Origin` must allowlist the exact staging web origin; do not use wildcard `*` for the staging verification path.
- `Access-Control-Allow-Methods: GET,HEAD,OPTIONS`.
- Expose `Content-Length`, `Content-Range`, `Accept-Ranges`, `ETag`, and `Last-Modified` when supported.
- Byte-range requests should be supported for segments/media delivery.
- Cache-control can be long-lived because object paths are versioned by staging pack path; purge/delete remains the rollback path.

## Verification commands after upload

Replace `STAGING_DRAMA_MEDIA_BASE_URL` with the approved staging media base URL.
If verification requires signed URLs, generate fresh short-lived values for this
run only, redact query strings before pasting evidence into GitHub, and do not
reuse signed URLs from logs, CI output, review comments, or previous runs.

```bash
BASE="$STAGING_DRAMA_MEDIA_BASE_URL/dramas/suspense-1913"
for ep in 1 2 3 4; do
  curl -fsSI "$BASE/ep${ep}/index.m3u8"
  curl -fsS "$BASE/ep${ep}/index.m3u8" | grep -E '^#EXTM3U|seg_[0-9]{3}\.ts'
  first_segment=$(curl -fsS "$BASE/ep${ep}/index.m3u8" | grep -E 'seg_[0-9]{3}\.ts' | head -1)
  curl -fsSI "$BASE/ep${ep}/${first_segment}"
done
```

Expected:

- All playlists return HTTP 200.
- Playlist responses use `application/vnd.apple.mpegurl` or a compatible HLS playlist content type.
- Segment responses use `video/MP2T` or a compatible MPEG-TS content type.
- Segment URLs listed in each playlist are relative and resolve under the same episode directory.

## Seed metadata shape

The staging seed implementation should create one `Drama`, four `Episode` rows, and four `VideoAsset` rows. Each asset should retain provenance in `VideoAsset.metadata`, following the existing fixture style plus a namespaced provenance block:

```json
{
  "fixture": true,
  "aspectRatio": "4:3",
  "stagingPack": "suspense-1913-v1",
  "provenance": {
    "originalWork": "Suspense (1913), dir. Lois Weber and Phillips Smalley",
    "rightsStatus": "Public domain in the United States; pre-1928 publication / PD-1923 evidence on Wikimedia Commons",
    "source": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Suspense_(1913).webm",
    "sourceFileUrl": "https://upload.wikimedia.org/wikipedia/commons/2/28/Suspense_%281913%29.webm",
    "license": "Public domain / PD-1923",
    "licenseEvidenceUrl": "https://commons.wikimedia.org/wiki/Template:PD-1923",
    "attribution": "Suspense (1913), public domain; source retained for evidence, attribution not required by PD status",
    "modifiedForStaging": true,
    "clip": {
      "startSec": 0,
      "endSec": 152.5
    },
    "checksums": {
      "sourceSha256": "<fill after download>",
      "clipSha256": "<fill after clip>",
      "hlsManifestSha256": "<fill after package>",
      "hlsPackageSha256File": "HLS_SHA256SUMS"
    },
    "seededBy": "GitHub #179 / Kanban t_ccf778c3",
    "seedVersion": 1
  }
}
```

Per-episode `clip.startSec`, `clip.endSec`, and checksum values must be updated to the concrete values generated during packaging.

## Staging seed script

Deletion note (#218): the former code seed at `packages/db/prisma/staging-suspense-1913.seed.mjs` was removed during the novels-only pivot cleanup. This document is retained only as historical packaging/reference material; there is no active staging Suspense seed script or `seed:staging:suspense-1913` command in the workspace.

Before #218, the code seed for this pack lived at `packages/db/prisma/staging-suspense-1913.seed.mjs` and was intentionally separate from the default development seed. It only ran when explicitly enabled and refused production-like environments.

Historical required environment before deletion:

```bash
SEED_DRAMA_STAGING_PACK=1
NODE_ENV=staging # or APP_ENV/VERCEL_ENV set to development, staging, or test; production/prod and unset envs are refused
STAGING_DRAMA_MEDIA_BASE_URL=https://<approved-staging-media-host>
DATABASE_URL=<staging database URL>
```

Historical run command before deletion:

```bash
pnpm --filter @novelhub/db seed:staging:suspense-1913
```

The seed upserts by stable slug/episode/video identifiers, so repeated runs should leave exactly one `suspense-1913` drama, four episodes, and four episode video assets. Current access semantics are explicit in both `Drama.freeEpisodeCount` and `Episode.isFree`: episodes 1-2 are free (`freeEpisodeCount=2`), episodes 3-4 are locked.

Local validation commands:

```bash
pnpm --filter @novelhub/db test:staging:suspense-1913
SEED_DRAMA_STAGING_PACK=1 NODE_ENV=staging STAGING_DRAMA_MEDIA_BASE_URL=https://staging-media.example.test pnpm --filter @novelhub/db seed:staging:suspense-1913
# Repeat the seed command once against a scratch/staging-like DB to confirm idempotency.
```

Count check after a scratch/staging seed run:

```sql
SELECT slug, total_episodes, free_episode_count FROM dramas WHERE slug = 'suspense-1913';
SELECT episode_number, is_free FROM episodes WHERE drama_id = (SELECT id FROM dramas WHERE slug = 'suspense-1913') ORDER BY episode_number;
SELECT COUNT(*) FROM video_assets WHERE episode_id IN (SELECT id FROM episodes WHERE drama_id = (SELECT id FROM dramas WHERE slug = 'suspense-1913'));
```

## Rollback and delete instructions

Media rollback:

1. Disable or remove the staging seed rows first if the app is already pointing to these URLs.
2. Delete only the staging prefix:
   - `dramas/suspense-1913/ep1/`
   - `dramas/suspense-1913/ep2/`
   - `dramas/suspense-1913/ep3/`
   - `dramas/suspense-1913/ep4/`
3. Purge the staging CDN cache for `/dramas/suspense-1913/*` if the provider caches deleted objects.
4. Re-run the verification commands and confirm playlists return 404/403, not a stale 200.

Data rollback for the seed task:

```sql
DELETE FROM dramas WHERE slug = 'suspense-1913';
```

The `episodes` and `video_assets` rows cascade from `dramas` / `episodes` via the short-drama migration relations. If a staging database has drifted from the reviewed migration, delete children explicitly before deleting the drama:

```sql
DELETE FROM video_assets WHERE episode_id IN (SELECT id FROM episodes WHERE drama_id = (SELECT id FROM dramas WHERE slug = 'suspense-1913'));
DELETE FROM episodes WHERE drama_id = (SELECT id FROM dramas WHERE slug = 'suspense-1913');
DELETE FROM dramas WHERE slug = 'suspense-1913';
```

Confirm teardown:

```sql
SELECT COUNT(*) FROM dramas WHERE slug = 'suspense-1913';
SELECT COUNT(*) FROM episodes WHERE drama_id = '66666666-6666-4666-8666-666666666666';
SELECT COUNT(*) FROM video_assets WHERE episode_id IN ('66666666-0001-4d00-8d00-000000000001', '66666666-0002-4d00-8d00-000000000002', '66666666-0003-4d00-8d00-000000000003', '66666666-0004-4d00-8d00-000000000004');
```

Do not delete any production objects or rows.

## Runbook evidence to paste back to #179

When T2 is executed, paste:

- Approved staging media base URL host, with secrets omitted.
- Source download command and source SHA-256.
- Four clip SHA-256 values.
- HLS package checksum file or manifest.
- `curl -I` output for all four `index.m3u8` files and one segment per episode.
- Confirmation that `HLS_ALLOWED_HOSTS` includes the staging media hostname if admin APIs write these URLs.
- Confirmation that production buckets and production DB were not touched.
