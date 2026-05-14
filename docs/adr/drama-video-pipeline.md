# ADR: Phase 3 Video Pipeline — External/Mock HLS First

> Superseded for active launch direction (#219): this short-drama artifact is retained only as historical/reference material after the novels-only pivot (#195/#204) and the drama cutoff/removal sequence (#215-#218). Do not use it to launch, seed, QA, or configure active drama surfaces. True-delete/data/media/schema/live DNS/domain/cert/CDN/secrets/R2/DB teardown is out of scope here and tracked separately by #220 / `docs/pivot/drama-true-delete-runbook.md`.

Status: DRAFT FOR HUMAN APPROVAL — DRAMA-006 revised
Date: 2026-05-10
Related spec: `docs/phase3-short-drama-mvp-spec.md`
Related resolution: `docs/adr/drama-phase3-feasibility-resolution.md`

## Context

NovelHub is entering Phase 3: short-drama MVP product development. The existing platform is live on Cloudflare and currently serves web-novel content from R2 text files. Short drama requires video playback, but the user wants to skip formal operations/launch activities for now and focus on product development first.

Three video-pipeline options were considered:

1. Cloudflare Stream.
2. R2 + pre-transcoded HLS.
3. External/mock HLS URLs first.

The user selected option 3 and clarified that Phase 3 alpha content should use demo/mock content first. Domain routing will make `www.dramavela.com` / `dramavela.com` drama-primary while the existing novel experience remains available at `novel.dramavela.com`.

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

## DRAMA-006 external HLS guardrails

External/mock HLS remains acceptable for alpha, but implementation must add guardrails before production alpha content is entered through admin:

- Production alpha HLS URLs must use `https`. Local/CI fixtures may use localhost HTTP only in non-production.
- Allowed production hosts are configured by `HLS_ALLOWED_HOSTS`; admin writes reject unapproved hosts.
- URLs with userinfo (`user:pass@host`) are rejected.
- URLs with credential-bearing or token-like query parameters such as `token`, `sig`, `signature`, `expires`, `key`, or `policy` are rejected unless a later signed-URL ADR explicitly allows them.
- CI and local e2e must use a deterministic `.m3u8` fixture served from a controlled fixture host; tests must not depend on third-party HLS availability.
- Browser CORS/playability must be validated for approved alpha hosts and documented in the runbook. This may be an operational validation rather than a synchronous database-write dependency.
- Returning direct HLS URLs after access is granted is an accepted alpha limitation; DRM, signed manifests, and proxying video bytes remain out of scope until a later video-pipeline ADR.

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
