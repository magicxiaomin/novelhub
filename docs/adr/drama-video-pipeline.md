# ADR: Phase 3 Video Pipeline — External/Mock HLS First

Status: DRAFT FOR HUMAN APPROVAL  
Date: 2026-05-10  
Related spec: `docs/phase3-short-drama-mvp-spec.md`

## Context

NovelHub is entering Phase 3: short-drama MVP product development. The existing platform is live on Cloudflare and currently serves web-novel content from R2 text files. Short drama requires video playback, but the user wants to skip formal operations/launch activities for now and focus on product development first.

Three video-pipeline options were considered:

1. Cloudflare Stream.
2. R2 + pre-transcoded HLS.
3. External/mock HLS URLs first.

The user selected option 3.

## Decision

For Phase 3 MVP, use external/mock HLS URLs as the playback source.

The product will store playback metadata in a `VideoAsset` concept/table, but will not yet build:

- video upload UI;
- transcoding pipeline;
- Cloudflare Stream integration;
- ffmpeg processing;
- R2 HLS segment upload/management;
- DRM or advanced anti-piracy.

## Rationale

This lets the team validate the user-facing short-drama loop first:

- browse dramas;
- play a vertical episode;
- enforce episode paywall;
- unlock via existing coins/subscription;
- resume watch progress;
- manage metadata in admin.

It avoids spending engineering time on video infrastructure before the product experience is validated.

## Consequences

### Positive

- Fastest path to product validation.
- Minimal infrastructure risk.
- No new Cloudflare billing surface yet.
- Allows player/paywall/admin/data model to be built independently of provider choice.

### Negative

- External URL reliability depends on the source.
- No first-party upload/transcode workflow.
- Anti-hotlinking and asset control are weak in MVP.
- Later migration to Cloudflare Stream/R2 HLS still required before serious launch.

## Data model implications

`VideoAsset` should include provider abstraction from day one, for example:

- `provider`: `external_hls`, later `cloudflare_stream` or `r2_hls`.
- `hlsUrl`: external playlist URL for MVP.
- `posterUrl`: portrait poster image URL.
- `previewUrl`: optional preview clip URL.
- `status`: `ready`, `processing`, `failed`, etc.
- provider-specific fields should be nullable or JSON until a later provider is selected.

## Deferred decisions

- Cloudflare Stream vs R2 HLS for production-grade pipeline.
- Upload UI.
- Transcoding automation.
- Signed playback URLs.
- DRM / tokenized playback.
- Video storage cost model.

## Revisit trigger

Revisit this ADR when any of the following becomes true:

- alpha product loop is approved;
- real licensed/self-produced video assets are available;
- external/mock URL reliability blocks testing;
- launch planning resumes;
- content volume exceeds manual URL binding capacity.
