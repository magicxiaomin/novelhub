# ADR: Phase 3 Drama Feasibility Resolution

Status: READY FOR HUMAN APPROVAL
Date: 2026-05-10
Related spec: `docs/phase3-short-drama-mvp-spec.md`
Related plan: `docs/phase3-short-drama-implementation-plan.md`
Supersedes: ambiguous Phase 3 draft assumptions about `/api/*` backend paths, dual Nest/Worker implementation, and undeclared domain/auth/HLS policies.

## Context

Codex feasibility review DRAMA-005 found the short-drama MVP feasible, but not ready for #132 human approval until the planning docs were grounded in the current repository. The repo currently has both Nest modules and Cloudflare Worker/Hono routes, with Worker routes mounted at resource-root paths such as `/auth`, `/books`, `/chapters`, `/coins`, `/unlocks`, `/reading-progress`, `/checkin`, `/admin`, and `/payments`. The Phase 3 draft also required `dramavela.com` to become drama-first while preserving novels at `novel.dramavela.com`, but the repo currently has no host-based middleware/domain-routing layer.

## Codex finding resolution table

| Finding                                                                                              | Decision                | Final resolution                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API paths in docs used `/api/dramas` while current Worker/Nest surfaces are resource-rooted.         | ADOPT                   | Backend contracts use resource-root paths: `/dramas`, `/episodes`, `/episodes/:id/playback`, `/episodes/:id/unlock`, `/drama-progress` or `/episodes/:id/progress`, and `/admin/...`. Frontend may proxy or rewrite via `/api/*` inside Next/Pages, but `/api` is not part of the backend contract unless a later Pages routing PR explicitly adds it.                              |
| `dramavela.com` drama-first plus `novel.dramavela.com` novel preservation lacked a routing strategy. | ADOPT WITH MODIFICATION | Use Cloudflare Pages routing with two deployed variants from the same repo: apex/www serve the drama-first variant; `novel.dramavela.com` serves the existing novel variant. Prefer build-time/env variant selection over new edge middleware for MVP because the repo has no middleware layer today.                                                                               |
| Auth/cookie/CORS behavior across subdomains was unspecified.                                         | ADOPT                   | Add a pre-frontend implementation gate for shared-cookie and CORS behavior: `Domain=.dramavela.com`, `Secure`, `HttpOnly`, `SameSite=Lax`, credentialed CORS allowlist using `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_BASE_URL`, and `CORS_EXTRA_ORIGINS`, plus local/preview exceptions.                                                                                            |
| External HLS fixture/admin URL validation was too loose.                                             | ADOPT WITH GUARDS       | Production alpha allows only HTTPS HLS URLs on approved hosts, no userinfo, no credential-bearing/token-like query strings, deterministic local/CI `.m3u8` fixture, and documented CORS/playability validation. Direct HLS URL leakage remains an accepted alpha limitation until a signed/redirect video pipeline is approved.                                                     |
| Phase 3 did not decide between Nest and Worker/Hono implementation.                                  | MODIFY                  | New drama APIs target Cloudflare Worker/Hono as the production runtime. Do not build parallel Nest drama controllers for MVP. Existing Nest modules remain untouched for current flows; if parity is later required, it needs a separate task and approval.                                                                                                                         |
| Schema details were underspecified.                                                                  | ADOPT                   | Add `Drama.slug`; add User relations for `episodeUnlocks` and `watchProgress`; define `totalEpisodes` as a derived/cache field maintained by service transactions; add browse and continue-watching indexes; enforce userId/guestId XOR in service code with database partial-unique indexes where Prisma supports raw migration SQL; document nullable unique behavior explicitly. |
| DRAMA-010+ issue order allowed unsafe parallelism.                                                   | ADOPT                   | Schema/seed and API contracts unblock admin/web/e2e. Domain routing/auth-cookie/CORS spike must land before full frontend implementation. Web catalog may start only after API contracts; player/unlock/resume waits for playback, unlock, progress, and cross-subdomain auth decisions.                                                                                            |

## Final architecture decisions

1. Backend runtime: Cloudflare Worker/Hono is the target runtime for all new short-drama routes.
2. Backend path convention: resource-rooted routes only; no `/api` prefix in Worker contracts.
3. Frontend boundary: `NEXT_PUBLIC_API_BASE_URL` points at the Worker origin. Any `/api/*` path is a frontend rewrite/proxy implementation detail, not API documentation.
4. Domain strategy: Cloudflare Pages serves two variants from the same repo/build target:
   - `dramavela.com` and `www.dramavela.com`: drama-first experience.
   - `novel.dramavela.com`: preserved novel experience.
5. Auth strategy: shared HTTP-only cookie scoped to `.dramavela.com` if the auth/CORS spike proves compatibility; otherwise stop and request human approval before changing auth semantics.
6. HLS strategy: direct external/mock HLS is allowed for alpha only under allowlisted-host validation and deterministic CI fixtures.
7. Data strategy: separate drama/video tables remain the approved direction; no reuse of `Book`/`Chapter` for video and no polymorphic content abstraction in MVP.

## Required environment/config additions

- `NEXT_PUBLIC_APP_URL`: canonical frontend origin for the deployed variant.
- `NEXT_PUBLIC_API_BASE_URL`: Worker/API origin used by both drama and novel variants.
- `CORS_EXTRA_ORIGINS`: comma-separated extra allowed origins for Worker credentialed CORS, including apex/www, novel subdomain, Pages previews, and local dev as needed.
- `HLS_ALLOWED_HOSTS`: comma-separated approved HLS hostnames for production alpha; CI/local fixture hosts may be allowed only in non-production.
- Optional build selector such as `SITE_VARIANT=drama|novel` if the frontend uses one codebase for two Pages projects.

## Final API contract shape

Public/resource routes:

- `GET /dramas` — list published dramas with pagination and browse filters.
- `GET /dramas/:slug` — drama detail, ordered episode metadata, and access/progress state when authenticated.
- `GET /episodes/:id/playback` or `GET /dramas/:slug/episodes/:episodeNumber/playback` — playback metadata only when free, unlocked, or subscription-accessible.
- `POST /episodes/:id/unlock` or scoped drama equivalent — idempotent coin unlock.
- `GET /me/drama-progress` — continue-watching state for the current authenticated user.
- `PUT /episodes/:id/progress` or `POST /drama-progress` — throttling-safe progress upsert.

Admin routes:

- `GET/POST/PATCH /admin/dramas...`
- `GET/POST/PATCH /admin/dramas/:dramaId/episodes...`
- `PATCH /admin/episodes/:episodeId/video-asset` for external HLS/poster URL binding and validation.

The implementer may choose the scoped or episode-id route variant during API contract work, but must keep the final paths resource-rooted and consistent across docs, tests, Worker routes, and frontend API clients.

## Final acceptance criteria additions

- AC-API-PATHS: Worker drama/episode endpoints are documented and implemented at resource-root paths. Worker does not require `/api/*` routes for drama. Frontend tests assert no hardcoded backend `/api/dramas` dependency.
- AC-RUNTIME: New short-drama APIs are implemented in Worker/Hono only for MVP; no new Nest drama controllers are required. Existing Nest/novel behavior remains green.
- AC-DOMAIN: `dramavela.com` and `www.dramavela.com` serve drama-first UX; `novel.dramavela.com` serves the preserved novel UX; both use the same API origin with explicit CORS allowlisting.
- AC-AUTH-CORS: Cross-subdomain login/session behavior is verified before full frontend implementation. Cookie attributes and CORS origins are documented and tested for apex, www, novel subdomain, preview, and local dev cases.
- AC-HLS-VALIDATION: Admin URL writes reject non-HTTPS production URLs, unapproved hosts, userinfo, credential/token-like query parameters, and malformed playlists where validation is possible.
- AC-HLS-CI: CI/e2e playback uses a deterministic fixture `.m3u8` and does not depend on a third-party provider.
- AC-SCHEMA-SLUG: `Drama.slug` is unique, non-null, and used for public detail routes.
- AC-SCHEMA-RELATIONS: `User` has explicit relations to episode unlocks and watch progress.
- AC-SCHEMA-TOTAL: `Drama.totalEpisodes`, if stored, is derived and transactionally maintained from episode mutations; admin cannot directly author it.
- AC-SCHEMA-XOR: `EpisodeUnlock` and `WatchProgress` enforce exactly one actor key (`userId` XOR `guestId`) at the service layer and use partial unique indexes for non-null actor keys where the database supports them.
- AC-ORDERING: DRAMA-010+ implementation cannot start before #132 approval; schema/seed and API contract tasks gate admin/web/e2e; auth/domain spike gates full frontend work.

## PR sequence and human gates

1. Documentation resolution PR: update spec, data-model ADR, video-pipeline ADR, implementation plan, and this ADR. Human gate: approve #132 before implementation tasks are created/dispatched.
2. Schema PR after approval: additive Prisma migration, indexes, seed/fixture data. Human gate: schema/data-model review.
3. API contract/runtime PR: Worker route contracts and tests. Gate: backend contract review.
4. Auth/CORS/domain spike PR: shared cookie, allowlist, env matrix, Pages variant decision. Human/security gate before frontend full implementation.
5. Admin/API PRs: admin CRUD and HLS validation. Gate: no credential-bearing production HLS URLs; alpha direct URL limitation accepted.
6. Web PRs: drama browse/detail/player/unlock/progress and novel subdomain preservation. Gate: product/UX review.
7. E2E/regression PR: deterministic HLS fixture, drama happy path, existing novel smoke. Gate: CI and manual staging smoke.
8. Merge to `main`: human approval required.
