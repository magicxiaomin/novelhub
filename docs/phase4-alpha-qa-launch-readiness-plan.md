# Phase 4 — Alpha QA and Launch Readiness Plan

Status: REVIEWED — docs-only; implementation tasks tracked separately
Owner: NovelHub QA / Release / Requirements
Created: 2026-05-11
Reviewed: 2026-05-12
Related: GitHub #169 / PHASE4-001 / PHASE4-003; `docs/phase3-short-drama-mvp-spec.md`; `docs/phase3-short-drama-ux-spec.md`; `docs/operations.md`; `docs/admin-guide.md`

This plan validates the completed short-drama MVP for alpha readiness. It does not implement product code and does not authorize production DNS changes, Stripe live payment changes, production secret changes, real external credentials, or irreversible data operations.

## 1. Restated requirement

Create an actionable QA and launch-readiness plan for the short-drama MVP alpha. The plan must cover:

- Staging and current-production smoke checks.
- Mobile browse, drama detail, vertical player, locked/paywall, unlock, and resume QA.
- Admin metadata workflow QA using mock/demo content.
- Demo content quality checks.
- A risk register.
- Explicit launch-readiness criteria.
- Recommended follow-up GitHub issues / Kanban tasks.
- Validation and inspection commands.

The output is a documentation artifact only. Any defects, missing automation, content gaps, or release decisions found by this plan should become follow-up issues/tasks rather than being fixed inside this requirements task.

## 2. Clarifying questions and assumptions

### Clarifying questions

1. Does current production already contain any drama rows, or should production alpha begin with no public drama content until demo content is added through approved admin flows?
2. What is the exact alpha exposure posture: internal-only, allowlisted users, a small public percentage, or fully public behind a feature flag?
3. Are `shortdrama_mvp` and `shortdrama_admin` the final feature flag names and are they flippable without redeploy?
4. What is the canonical deterministic demo `.m3u8` fixture host, and is it included in `HLS_ALLOWED_HOSTS` for staging and production?
5. How should QA obtain a staging/prod editor account without reading or changing secrets?
6. Did guest watch progress ship as server-side guest IDs or browser-local fallback? Authenticated resume remains the hard launch gate either way.
7. Should the demo catalog include an 18+ / age-gated item for alpha, or should age-gate QA be explicitly deferred?
8. What browser matrix is required for sign-off beyond iOS Safari and Android Chrome?

### Assumptions

- Phase 3 implementation is already merged; this task verifies launch readiness rather than defining new product scope.
- Staging is the release gate. Production promotion remains manual per `docs/operations.md`.
- Existing `scripts/smoke.sh` is the baseline smoke command and currently covers pre-drama app health.
- Staging data can be reseeded only through documented idempotent operations; production data must not be wiped, bulk-replaced, or destructively edited.
- Stripe remains in test mode; alpha validates coin unlocks and subscription-bypass behavior, not live payment acceptance.
- All demo content is mock/demo content with no real licensed video, no PII, and no real external credentials.


## 2A. PHASE4-002 feasibility challenge resolution

The feasibility challenge is adopted as a sequencing change: do not spend mobile/admin/demo QA time while `/dramas` is returning HTTP 500 or while drama smoke coverage is missing. The revised plan turns drama API health into the first hard gate after baseline app health.

| Feasibility finding / challenge | Decision | Final resolution |
| --- | --- | --- |
| `/dramas` currently may return HTTP 500, so browser QA can produce misleading failures. | Adopt | Diagnose and fix-or-escalate `/dramas` 500 before mobile browse/detail/player, admin workflow, demo content, accessibility, analytics, or rollback QA. A green `GET /dramas` smoke is the first drama-specific hard gate. |
| Existing `scripts/smoke.sh` is novel/base-app oriented and lacks drama coverage. | Adopt | Add hard-fail drama smoke as a foundation task. It must fail the run on `/dramas` 5xx, bad detail, bad playback entitlement, leaking locked HLS URLs, missing auth on unlock/progress/admin, or novel regression failures. |
| API path examples in PHASE4-001 used nested drama playback URLs, but current Worker routes expose playback/unlock under `/episodes`. | Modify | Use current shipped route shape for API smoke: `GET /dramas`, `GET /dramas/:slug`, `GET /episodes/:episodeId/playback`, `POST /episodes/:episodeId/unlock`, and `GET/POST /drama-progress`. Keep web URLs as `/dramas/:slug/watch/:episodeId`. |
| E2E drama regression exists but can skip when routes/seed data are unavailable. | Modify | Treat Playwright drama regression as a later confidence gate, not as the first blocker. Hard-fail API smoke must come first because it cannot silently skip `/dramas` 500. |
| Deterministic HLS/poster fixtures are required to avoid third-party flake. | Adopt | Require a deterministic allowlisted fixture host or checked-in mocked fixture strategy before mobile/player QA sign-off. Staging/prod alpha must not depend on fragile or credentialed streams. |
| Feature flag names and no-secret admin/editor provisioning are unresolved. | Adopt | Keep as human approval gates before admin/prod-mirroring QA. Do not read/change production secrets or real credentials to unblock QA. |
| Production data state and demo mirroring are unknown. | Adopt | Production checks stay read-only except explicitly approved reversible demo admin operations; no wipes, hard deletes, raw schema edits, or blind replacement of existing content. |
| Some checklist items are broad and should be execution ordered. | Adopt | Split work into ordered foundation, smoke, QA, and decision tasks below; mobile/admin/demo work is blocked until `/dramas` diagnosis and hard-fail drama smoke pass. |

## 3. Scope and non-goals

### In scope

- Smoke validation for staging and current production.
- Public short-drama flow QA: browse/home, drama detail, episode player, locked/paywall state, coin unlock, subscription bypass, progress save, and resume.
- Existing novel regression smoke so drama launch does not break the novel funnel.
- Admin QA for drama and episode metadata: create/edit/list, external/mock HLS URL binding, poster URL binding, publish/free-paid toggles, validation, and optimistic-lock/error handling where implemented.
- Demo content quality review: catalog breadth, playable fixtures, posters, copy, default prices/free counts, and deliberate edge cases.
- Accessibility spot checks for home/detail/player.
- Rollback and feature-flag readiness checks on staging.
- Risk register and go/no-go checklist.
- Follow-up issue/task recommendations.

### Explicit non-goals

- Production DNS, registrar, or Cloudflare zone changes.
- Stripe live mode, live payment keys, or live webhook changes.
- Reading, rotating, or changing production secrets.
- Real third-party credentials or licensed external content onboarding.
- Irreversible production data operations, including wipes, hard deletes, schema rollbacks, or blind replacement of already-sold content.
- Paid ads, SEO launch, KOL/social launch, newsletter launch, or broader growth launch.
- Building new features in this requirements task.

## 4. User stories

### Viewer stories

- As an alpha viewer on mobile, I can discover a drama and start episode 1 quickly.
- As an anonymous viewer, I can watch free episodes without signing in.
- As a viewer, I can distinguish free and locked episodes without relying on color alone.
- As a logged-in viewer with coins, I can unlock a paid episode and immediately watch it.
- As a subscriber in test-mode validation, I can access paid episodes without spending coins.
- As a logged-in viewer, I can leave mid-episode and resume near my last saved position.
- As a viewer, I see clear retry/error states if an external/mock HLS URL fails.

### Admin/editor stories

- As an editor, I can create a demo drama, add ordered episodes, paste external/mock HLS and poster URLs, mark episodes free/paid, and publish only when required metadata is valid.
- As an editor, I can see validation errors before broken or unsafe HLS/poster URLs are exposed publicly.
- As an editor, I cannot accidentally publish an empty or incomplete drama.
- As an editor, concurrent edits do not silently overwrite each other where optimistic locking is present.

### Release/operator stories

- As a release manager, I can run documented smoke commands and see clear pass/fail output for both novel and drama paths.
- As a release manager, I can verify feature flags and rollback paths before alpha exposure.
- As a release manager, I can record a go/no-go decision with named owners and explicit exclusions.

## 5. Acceptance criteria

### 5.1 Smoke checks

- QA-AC-1: `API=https://api-staging.whoryou.club bash scripts/smoke.sh` passes with zero failures for baseline app/novel health.
- QA-AC-2: `API=https://api.dramavela.com bash scripts/smoke.sh` passes with zero failures against current production/test-mode configuration before any alpha exposure.
- QA-AC-3: `/dramas` 500 diagnosis is complete before mobile/admin/demo QA starts. If `GET /dramas` returns any 5xx on staging, stop and create/fix a blocker defect; do not proceed to browser QA.
- QA-AC-4: Hard-fail drama smoke covers `GET /dramas`, `GET /dramas/:slug`, `GET /episodes/:episodeId/playback`, `POST /episodes/:episodeId/unlock`, `GET/POST /drama-progress`, locked playback denial/no-leak, and admin auth gating.
- QA-AC-5: Locked playback responses do not expose HLS URLs or other playable metadata before access is granted.
- QA-AC-6: Existing novel browse/read/paywall/unlock smoke remains green.
- QA-AC-7: Smoke output records the final expected pass count after drama checks are added and exits non-zero on every drama blocker, without skip-based false greens.

### 5.2 Mobile browse/detail/player/paywall/resume QA

- QA-AC-8: Home/browse loads on mobile with drama entry surfaces and no layout-breaking shifts.
- QA-AC-9: Signed-in users with watch history see Continue Watching; anonymous users do not.
- QA-AC-10: Drama detail shows poster, title, synopsis, metadata, and ordered episodes with free/locked state.
- QA-AC-11: Episode order is preserved; sparse ordering is not silently renumbered.
- QA-AC-12: Free episodes play for anonymous and logged-in users.
- QA-AC-13: Player supports expected core controls: play/pause, seek, mute/volume, fullscreen, loading, retry, and fatal-error state.
- QA-AC-14: Browser autoplay policy is respected; the player does not assume autoplay with sound.
- QA-AC-15: Locked episodes show a paywall/locked state inside the player context rather than failing silently.
- QA-AC-16: Logged-in coin unlock succeeds, is idempotent on retry, and allows immediate playback.
- QA-AC-17: Active subscription/test entitlement bypasses paid locks without coin spend.
- QA-AC-18: Resume restores authenticated users near the previous playback position after leaving and returning.
- QA-AC-19: Mobile checks pass at minimum on iOS Safari and Android Chrome, with desktop cross-browser results recorded separately.

### 5.3 Admin metadata workflow QA

- QA-AC-20: Editor/admin can create, edit, and list drama records.
- QA-AC-21: Editor/admin can create, edit, and list episodes under a drama.
- QA-AC-22: Editor/admin can bind external/mock HLS URLs and poster URLs without uploading video files.
- QA-AC-23: Invalid HLS/poster URLs are rejected or clearly marked invalid before publish, including non-HTTPS, malformed URLs, disallowed hosts, userinfo, and credential-like query strings.
- QA-AC-24: Free/paid and draft/published state changes are reflected in public APIs.
- QA-AC-25: Unpublished dramas/episodes are absent from public browse/detail/playback.
- QA-AC-26: Publishing an empty or incomplete drama is blocked with an explicit reason.
- QA-AC-27: Admin endpoints require authenticated admin/editor access and return 401/403 for unauthorized users.

### 5.4 Demo content quality

- QA-AC-28: Demo catalog is broad enough for hero and multiple rows without obvious repetition; suggested target is at least six demo dramas unless product chooses a smaller alpha set.
- QA-AC-29: Each playable demo episode has a browser-playable allowlisted `.m3u8` URL and valid poster/thumbnail assets.
- QA-AC-30: Defaults match Phase 3 expectations: 3 free episodes and 5 coins per paid episode unless intentionally varied for edge-case coverage.
- QA-AC-31: Demo copy is coherent, clearly fictional/demo, and free of lorem ipsum, placeholder text, real-person names, real brands/IP references, PII, and real payment data.
- QA-AC-32: At least one demo item exercises a sparse episode order and at least one intentionally broken/expired stream exercises the player fatal-error path.
- QA-AC-33: Demo content is hidden through draft/archive/unpublish flows rather than hard-deleted in production.

### 5.5 Launch readiness

- QA-AC-34: Rollback paths are rehearsed on staging: Worker rollback, Pages last-good promotion, and feature flag off.
- QA-AC-35: Accessibility spot checks pass: Home, Detail, and Player achieve Lighthouse accessibility score of at least 95 or documented waivers are approved.
- QA-AC-36: Analytics/debug checks confirm representative player, paywall, and admin events fire with usable properties where implemented.
- QA-AC-37: Go/no-go checklist is completed with named owners, dates, decision, and explicit confirmation that excluded items were untouched.

## 6. UX/API/data implications

### UX implications

- Paywall must be tested as a player state, not as a standalone navigation replacement.
- Continue Watching has distinct anonymous, signed-in-with-history, and signed-in-without-history states.
- Player QA must include external-stream failure because the MVP intentionally uses external/mock HLS URLs.
- Mobile-first is required, but desktop should not regress; use widened layouts rather than separate desktop-only flows.
- Locked/free state cannot be communicated by color alone.
- Accessibility checks need keyboard focus, dialog focus trapping, labels, and live-region behavior for loading/errors.

### API implications

- Smoke and QA should target resource-rooted API paths under `NEXT_PUBLIC_API_BASE_URL`, consistent with Phase 3 docs.
- Core routes to validate include drama list/detail, playback metadata, unlock, progress, and admin drama/episode management.
- Locked playback metadata must not leak HLS URLs before access is granted.
- Unlock must be atomic and idempotent: coin balance, coin transaction, and episode unlock must stay consistent.
- Progress writes must tolerate repeated/rapid updates.
- Public endpoints must retain existing validation, rate limiting, DTO/OpenAPI, and auth conventions.

### Data implications

- Drama content should remain separate from Book/Chapter data, using the Phase 3 drama-specific model direction.
- Existing novel data and migrations must not be deleted or rewritten.
- Demo data in production must be clearly labeled and managed via reversible publish/draft/archive flows.
- Production QA must avoid hard deletes, wipes, raw schema edits, and irreversible migration operations.
- URL allowlisting and safe HLS validation matter because external/mock HLS is browser-consumed in this MVP.

## 7. Risks and open decisions

### Risk register

| ID  | Risk                                                          | Likelihood | Impact                                | Mitigation                                                                                           |
| --- | ------------------------------------------------------------- | ---------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| R1  | External/mock HLS fails due to CORS, expiry, or host downtime | High       | Player appears broken                 | Use deterministic allowlisted fixture streams, validate URLs in admin, include retry/error UX checks |
| R2  | Paid HLS URL leaks before entitlement                         | Medium     | Access-control failure                | Add smoke assertion that locked playback returns no playable URL before access                       |
| R3  | Drama launch regresses novel funnel                           | Medium     | Revenue/user impact                   | Keep existing smoke/e2e novel regression as hard gate                                                |
| R4  | Stripe live scope accidentally pulled in                      | Medium     | Payment/compliance risk               | Explicitly exclude live payments; validate coin unlock/subscription bypass only                      |
| R5  | Production data accidentally mutated                          | Medium     | Irreversible damage                   | Read-only production QA except approved demo admin operations; no wipes/deletes/rollbacks            |
| R6  | Feature flags misconfigured                                   | Medium     | Premature exposure or inaccessible QA | Verify flag names, owners, and staging rollback before alpha                                         |
| R7  | iOS Safari player behavior differs from desktop               | Medium     | Core mobile UX failure                | Require real iOS Safari pass or documented device-equivalent pass                                    |
| R8  | Demo content looks fake, broken, or legally risky             | Medium     | Launch credibility/compliance risk    | Content quality checklist and product/content sign-off                                               |
| R9  | Admin account provisioning requires secrets                   | Low        | QA blocked                            | Define a no-secret editor provisioning path before admin QA                                          |
| R10 | Accessibility score misses target                             | Medium     | Launch quality risk                   | Run Lighthouse and keyboard/screen-reader spot checks before go/no-go                                |
| R11 | Smoke script lacks drama coverage                             | High       | False confidence                      | Create follow-up to extend smoke harness before readiness sign-off                                   |
| R12 | Guest resume is incomplete                                    | Low        | Scope ambiguity                       | Treat authenticated resume as hard gate; document guest behavior separately                          |

### Open decisions

- Alpha exposure: internal-only, allowlist, percentage rollout, or fully public.
- Feature flag names and operating procedure.
- Demo catalog size and ownership.
- Whether to include age-gated demo content.
- Whether to extend `scripts/smoke.sh` or create a separate drama smoke script.
- Minimum cross-browser matrix.
- Final go/no-go DRI and required signers.

## 8. Detailed checklists

### 8.1 Staging/current production smoke checklist

- [ ] Confirm repo branch/commit under test.
- [ ] Run staging base smoke: `API=https://api-staging.whoryou.club bash scripts/smoke.sh`.
- [ ] Run production base smoke: `API=https://api.dramavela.com bash scripts/smoke.sh`.
- [ ] Confirm `https://staging.whoryou.club` loads.
- [ ] Confirm `https://dramavela.com` and `https://www.dramavela.com` load without DNS or routing changes.
- [ ] Confirm unauthenticated `/auth/me` behavior is expected.
- [ ] Confirm `GET /dramas` returns published demo dramas where expected.
- [ ] Confirm drama detail returns ordered episodes.
- [ ] Confirm anonymous free playback returns HLS/poster metadata.
- [ ] Confirm anonymous locked playback denies access and returns no HLS URL.
- [ ] Confirm unlock requires auth.
- [ ] Confirm logged-in coin unlock succeeds and retry is idempotent.
- [ ] Confirm active test entitlement/subscription bypasses paid lock.
- [ ] Confirm progress save/retrieve works.
- [ ] Confirm admin drama endpoints require admin/editor auth.
- [ ] Confirm existing novel smoke still passes.

### 8.2 Mobile QA checklist

- [ ] Anonymous home/browse loads and exposes drama entry.
- [ ] Signed-in home shows Continue Watching when progress exists.
- [ ] Detail page shows poster, metadata, synopsis, and ordered episode list.
- [ ] Free episode plays on iOS Safari.
- [ ] Free episode plays on Android Chrome.
- [ ] Player controls work on mobile.
- [ ] Autoplay policy produces a clear gesture-required state when applicable.
- [ ] Locked episode shows paywall/locked state in the player context.
- [ ] Sign-in from locked state returns to the same episode context.
- [ ] Coin unlock returns to playback without stale entitlement.
- [ ] Resume returns near last position for authenticated user.
- [ ] Broken stream shows clear retry/fatal error and no blank screen.
- [ ] Offline/throttled network state is understandable.
- [ ] Keyboard and screen-reader spot checks pass on desktop.

### 8.3 Admin workflow checklist

- [ ] Editor can access admin drama list; non-editor cannot.
- [ ] Create demo drama with title, slug, synopsis, poster/banner metadata, status, free episode count, coin price, and ordering/featured metadata.
- [ ] Add ordered episodes with title, duration, order/episode number, free/paid, publish state.
- [ ] Bind allowlisted HTTPS `.m3u8` and poster URL.
- [ ] Validate rejection of unsafe/malformed URLs.
- [ ] Toggle draft/published and confirm public API visibility changes.
- [ ] Toggle free/paid and confirm public locked/free state changes.
- [ ] Attempt to publish incomplete drama and confirm explicit block reason.
- [ ] Exercise save error handling and dirty-state behavior.
- [ ] Exercise optimistic/concurrent edit behavior where implemented.
- [ ] Time creation of a 10-episode demo drama once asset URLs are ready.

### 8.4 Demo content checklist

- [ ] Catalog size approved.
- [ ] Hero and rows have no obvious repetition.
- [ ] Posters/thumbnails use correct aspect ratios and no broken images.
- [ ] Every playable episode loads in browser.
- [ ] One deliberate broken stream exists for QA.
- [ ] One sparse-order drama exists for no-renumber QA.
- [ ] Copy is polished, fictional, and free of placeholders/PII/IP risks.
- [ ] Default free count and coin price are correct unless intentionally varied.
- [ ] Age-gate decision is recorded.
- [ ] Hide/removal behavior uses draft/archive/unpublish, not production hard delete.

### 8.5 Staging rollback/safety checklist

- [ ] Worker rollback procedure is known and rehearsed on staging.
- [ ] Pages last-good promotion is known and rehearsed on staging.
- [ ] Public drama feature flag can be turned off on staging.
- [ ] Admin drama feature flag can be restricted on staging.
- [ ] Novel surface remains reachable after rollback/flag-off.
- [ ] No secrets, DNS, Stripe live settings, or irreversible production data operations are touched.

## 9. Launch readiness criteria

### Hard gates

- [ ] Staging smoke green, including drama checks once added.
- [ ] Current production smoke green, including drama checks once added where demo content exists.
- [ ] Existing novel regression green.
- [ ] Mobile browse/detail/player/paywall/resume pass on iOS Safari and Android Chrome.
- [ ] Locked playback metadata does not leak playable HLS before access.
- [ ] Coin unlock is atomic and idempotent.
- [ ] Authenticated resume works within acceptable tolerance.
- [ ] Admin metadata workflow passes with demo content.
- [ ] Demo content quality checklist passes.
- [ ] Feature flags and rollback paths are verified on staging.
- [ ] Accessibility score/spot checks pass or waivers are explicitly approved.
- [ ] Exclusions are confirmed untouched: DNS, Stripe live payments, secrets/credentials, irreversible prod data ops.

### Soft gates / waivable with owner approval

- [ ] Desktop cross-browser matrix complete.
- [ ] Analytics events spot-checked.
- [ ] Guest resume behavior documented.
- [ ] Operations doc updated with drama smoke/flag procedures.
- [ ] Known non-blocking defects triaged with owners and dates.

### Required sign-offs

- Product: scope, alpha exposure, demo content posture.
- Frontend: mobile player, paywall, resume, accessibility fixes.
- Backend: access control, unlock idempotency/atomicity, progress, admin auth.
- QA: smoke, mobile, admin, regression checklist completion.
- Release manager: flags, rollback, production exclusions.
- Content/compliance reviewer: demo content quality and no PII/IP concerns.

## 10. Validation and inspection commands

Commands inspected or recommended for validation:

```sh
# Repo/context inspection used for this plan
pwd
git status --short
command -v claude
HOME=/root/.claude-novelhub claude auth status --text || true
gh issue view 169 --json number,title,body,labels,state,url

# Local quality gates
pnpm install
pnpm --filter @novelhub/api lint
pnpm --filter @novelhub/api typecheck
pnpm --filter @novelhub/api test
pnpm --filter @novelhub/web lint
pnpm --filter @novelhub/web typecheck
pnpm --filter @novelhub/web test
pnpm --filter @novelhub/web build
pnpm test
pnpm typecheck
pnpm format:check

# Smoke per operations.md
API=https://api-staging.whoryou.club bash scripts/smoke.sh
API=https://api.dramavela.com bash scripts/smoke.sh

# First drama hard gate: stop if this is any 5xx before mobile/admin/demo QA
DRAMAS_STATUS=$(curl -sS -o /tmp/dramas.json -w '%{http_code}' https://api-staging.whoryou.club/dramas)
test "$DRAMAS_STATUS" -lt 500 || { echo "BLOCKER: /dramas returned $DRAMAS_STATUS"; head -c 500 /tmp/dramas.json; exit 1; }

# Manual drama API spot checks; replace placeholders with seeded/demo content
curl -s https://api-staging.whoryou.club/dramas | jq '.'
curl -s https://api-staging.whoryou.club/dramas/<demo-slug> | jq '.'
curl -s https://api-staging.whoryou.club/episodes/<free-episode-id>/playback | jq '.'
curl -s -o /tmp/locked.json -w '%{http_code}\n' https://api-staging.whoryou.club/episodes/<locked-episode-id>/playback
jq '.hlsUrl // .playbackUrl // .url' /tmp/locked.json

# Schema/migration sanity; do not run destructive operations against prod
pnpm --filter @novelhub/db exec prisma validate
pnpm --filter @novelhub/db exec prisma migrate status

# Existing operations doc says seed is idempotent, but staging only unless separately approved
# source /root/.novelhub-secrets
# DATABASE_URL=$STAGING_DB pnpm --filter @novelhub/db prisma:seed

# Accessibility spot checks
npx lighthouse https://staging.whoryou.club/ --only-categories=accessibility --quiet
npx lighthouse https://staging.whoryou.club/dramas/<demo-slug> --only-categories=accessibility --quiet
npx lighthouse "https://staging.whoryou.club/dramas/<demo-slug>/watch/<episode-id>" --only-categories=accessibility --quiet

# OpenAPI surface check, if docs-json is exposed
curl -s https://api-staging.whoryou.club/docs-json | jq '.paths | keys | map(select(test("dramas|episodes|drama-progress")))'

# Staging-only rollback rehearsal
cd apps/api && wrangler rollback --env staging
# Cloudflare Pages last-good promotion is performed in dashboard unless a repo-specific CLI path is documented.
```

GitHub traceability note: `gh issue view 169` is available in the orchestrator environment, and this plan is grounded in GitHub #169, the PHASE4-001/PHASE4-003 Kanban tasks, and repository docs. GitHub #169 remains the Phase 4 epic for follow-up execution issues.

## 11. Review resolution

Claude and Codex agreed this artifact should not be committed on the already-merged `pr-171` branch. The reviewed resolution is to persist it as a docs-only PR from latest `main`, keep product/code changes out of scope, and treat the follow-up items below as separate execution tasks.

Current blocker updates as of review:

- PR #171 has resolved the immediate `/dramas` 500 blocker by returning a non-500 disabled fallback when the drama schema is unavailable. This plan still keeps future `/dramas` 5xx responses as a hard stop before mobile/admin/demo QA.
- PR #173 covers Claude auto-review workflow reliability and is not part of this docs artifact. Its merge remains subject to repository/path-policy approval.
- Hard-fail drama smoke, deterministic fixtures, no-secret admin/editor provisioning, staging demo seed/import, and final go/no-go evidence remain separate follow-up tasks.

## 12. Proposal v1 for Codex feasibility review

Codex feasibility review should evaluate whether the plan is executable with the current codebase and deployment topology. Specific review prompts:

1. Is it better to extend `scripts/smoke.sh` with drama checks or add a separate `scripts/smoke-drama.sh` invoked by release QA?
2. Which exact API paths shipped for playback, unlock, and progress, and do the command examples need path updates?
3. Does the existing e2e suite already cover browse → free play → locked state → coin unlock → resume, or is a new Playwright spec required?
4. Where should deterministic demo `.m3u8` fixtures and posters live so CI/staging/prod alpha do not depend on fragile third-party streams?
5. Are `shortdrama_mvp` and `shortdrama_admin` real flags, where are they configured, and can staging QA flip them safely?
6. What is the approved no-secret path to obtain editor/admin QA access?
7. Are there known accessibility, iOS Safari, CORS, cookie-domain, or Cloudflare Worker limitations that should become hard pre-go issues?
8. What production data state exists today, and how can demo content be added without slug collisions or destructive operations?
9. Are any acceptance criteria too broad or not directly testable, and how should they be narrowed for execution issues?

Expected Codex output: feasibility verdict by checklist area, exact smoke/e2e implementation recommendation, any path corrections, fixture recommendations, and a list of blocker/non-blocker follow-up issues.


## 13. Final recommended task order and human approval gates

### Mandatory order

1. Baseline context and safety confirmation: confirm repo commit, staging/prod targets, and hard-stop exclusions. No DNS, Stripe Live, production secrets, real credentials, or destructive data changes.
2. Baseline smoke: run the current `scripts/smoke.sh` against staging and current production to ensure the novel/base app is green.
3. `/dramas` 500 diagnosis: directly probe `GET /dramas` on staging. If it returns 5xx, stop Phase 4 QA and create/fix the blocker before any mobile/admin/demo QA.
4. Hard-fail drama smoke implementation: extend `scripts/smoke.sh` or add a release-invoked drama smoke command that fails non-zero on drama API blockers and cannot skip `/dramas` 500.
5. Hard-fail drama smoke execution: validate list/detail/playback/unlock/progress/admin-gate paths using seeded/demo IDs.
6. Fixture and seed readiness: approve deterministic allowlisted `.m3u8` and poster fixtures plus reversible staging demo import/seed path.
7. Mobile public QA: only after steps 3-6 are green, run `/dramas`, detail, `/dramas/:slug/watch/:episodeId`, paywall, unlock, and resume on iOS Safari and Android Chrome.
8. Admin metadata QA: only after no-secret editor/admin provisioning is approved and smoke is green.
9. Demo content quality QA: only after fixture/seed readiness and admin workflow are stable.
10. Novel regression, accessibility, analytics/debug event spot checks, and staging rollback rehearsal.
11. Human go/no-go: compile evidence, sign-offs, known defects, and explicit exclusion confirmation.

### Human gates

- Product gate: alpha exposure posture, demo catalog size, age-gate decision, and browser matrix.
- Backend/release gate: `/dramas` 500 resolved, hard-fail drama smoke merged, current route contract approved, staging rollback known.
- Frontend gate: mobile player/paywall/resume UX approved after API smoke is green.
- Admin/content gate: no-secret editor provisioning, deterministic fixtures, demo copy/compliance, and reversible publish/draft/archive procedure.
- Production safety gate: production checks are read-only unless a named human approves a reversible admin demo operation; forbidden items remain untouched.
- Merge/release gate: all hard gates pass or are formally waived by named owners before alpha exposure.

## 14. Recommended follow-up GitHub issues / Kanban tasks

Suggested epic: `PHASE4-DRAMA-ALPHA-QA`.

### Foundation tasks

- P4-001: Diagnose and resolve any staging `GET /dramas` HTTP 500 before mobile/admin/demo QA.
- P4-002: Add hard-fail drama checks to smoke harness; include list/detail/free playback/locked denial/no-leak/unlock/progress/admin auth.
- P4-003: Create or identify deterministic demo HLS/poster fixture set and allowlisted host.
- P4-004: Prepare demo drama catalog and staging seed/import procedure.
- P4-005: Document no-secret editor/admin QA account provisioning.
- P4-006: Confirm feature flag names, owners, and rollback procedure.

### QA execution tasks

- P4-010: Run staging and current-production smoke pass; record command output.
- P4-011: Run mobile browse/detail/player/paywall/resume QA on iOS Safari and Android Chrome.
- P4-012: Run admin metadata workflow QA with mock/demo content.
- P4-013: Run demo content quality review.
- P4-014: Run novel regression smoke/e2e and record results.
- P4-015: Run accessibility spot checks on Home, Detail, and Player.
- P4-016: Run analytics/debug event spot check for player, paywall, and admin events.
- P4-017: Run desktop cross-browser pass.
- P4-018: Rehearse staging rollback and feature-flag-off paths.
- P4-019: Verify locked-playback no-leak, coin-unlock idempotency/atomicity, and progress-throttle behavior.

### Decision/release tasks

- P4-020: Decide alpha exposure posture and browser matrix.
- P4-021: Decide demo catalog size and age-gate inclusion.
- P4-022: Confirm production data state and demo mirroring plan.
- P4-023: Update `docs/operations.md` with drama smoke/flag procedures after implementation details are known.
- P4-024: Compile readiness checklist, gather sign-offs, and record go/no-go.

### Defect bucket

- P4-09x: Create one issue per defect found during P4-010 through P4-019, labeled as blocker or non-blocker against the hard gates in this document.

Recommended order: `/dramas` 500 diagnosis first, hard-fail drama smoke second, deterministic fixtures/seed readiness third, then mobile/admin/demo/content/a11y/analytics/rollback. Go/no-go occurs only after all hard gates are green or formally waived by named owners.
