# NovelHub Phase 2 Final Spec — Cloudflare Cutover

Status: FINAL SPEC FOR HUMAN APPROVAL
Scope: planning only; no implementation in this document.
Repo state basis: `chore/phase2-agent-workflow`, current Cloudflare migration work through PR #103, `docs/phase2-proposal-v1.md`, `docs/cloudflare-migration-phase0.md`, `docs/runbook.md`, `apps/api/src/worker/**`, `apps/api/wrangler.toml`, and `.github/workflows/e2e.yml`.

## 1. Codex feasibility findings resolution

| #   | Codex finding                                                                                                                     | Decision | Final resolution                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Proposal is stale: Cloudflare migration is already partly implemented on `chore/phase2-agent-workflow` / PR #103.                 | MODIFY   | Treat Phase 2 as a completion/cutover program, not a greenfield 19-task rewrite. Rebase all issue/PR planning around existing Hono Worker routes, Pages build/deploy work, Worker workflows, migration workflow, and runbook changes already present.                                                                         |
| 2   | DB runtime gate: Worker Prisma still uses `@prisma/adapter-pg` + `pg.Pool` over `DATABASE_URL`, not Workers adapter + Hyperdrive. | ADOPT    | This is the first hard gate. No route parity/cutover PR may be considered production-ready until Prisma runs through Hyperdrive in Worker runtime with automated smoke coverage.                                                                                                                                              |
| 3   | Rate limiting parity gaps remain versus Nest `@Throttle`.                                                                         | ADOPT    | Add an explicit rate-limit parity issue. Public auth/payment/support endpoints must have documented limits and automated or smoke validation before production traffic moves to Worker.                                                                                                                                       |
| 4   | CI/e2e still targets Nest API + standalone Next, not Worker/Pages parity.                                                         | ADOPT    | Add Worker/Pages parity CI before cutover. Existing Nest/Vercel e2e may remain as fallback coverage, but Phase 2 approval requires tests against the Cloudflare runtime path.                                                                                                                                                 |
| 5   | Ops/cutover prerequisites remain: production Hyperdrive, routes, secrets, DNS, Stripe dashboard.                                  | ADOPT    | Track as a separate human-gated ops issue. Engineering can prepare commands/docs, but owner-only dashboard/DNS/Stripe actions are explicit approval gates.                                                                                                                                                                    |
| 6   | Overengineering risk: full Nest-to-Hono rewrite needs justification and fallback.                                                 | MODIFY   | Keep the Cloudflare migration because the user has confirmed Option B and much code is already shipped, but add a kill-switch: if Hyperdrive/Prisma, Worker CPU/upload limits, Stripe webhook parity, or e2e parity fail, keep Vercel/Nest as the production path and ship only Pages/web or documentation-safe improvements. |

## 2. Final Phase 2 PRD

### Goal

Complete the Cloudflare Phase 2 migration so NovelHub can run the launch path on Cloudflare Pages + Cloudflare Workers + Supabase Postgres via Hyperdrive, while preserving the existing paid-acquisition user journey and keeping the Vercel/Nest path available as rollback until production smoke passes.

### Business rationale

- Reduce fixed launch infrastructure cost toward the confirmed Workers paid-plan target.
- Keep R2 egress/storage advantages for chapter and cover content.
- Simplify production surface around Cloudflare Pages, Workers, R2, KV, Hyperdrive, DNS, and routes.
- Preserve fast iteration for Meta ad tests without adding product scope.

### User-facing scope

No new reader, catalog, payment, admin, or growth features are introduced in Phase 2. The target is behavioral parity:

- public browse and free-chapter reading still work;
- auth uses HttpOnly cookies, not localStorage;
- locked chapters still enforce subscription/unlock rules;
- Stripe subscription/coin flows and webhook processing preserve semantics;
- Meta Pixel/CAPI event identity remains intact;
- R2 private chapter content remains signed and protected;
- admin book/chapter management remains admin-only.

### Non-goals

- No new monetization model.
- No redesign of the PWA.
- No database schema rewrite unless required by Worker runtime compatibility.
- No removal of the Nest/Vercel fallback before Cloudflare production smoke succeeds.
- No broad refactor outside migration parity, tests, and runbook/cutover documentation.

## 3. Technical spec

### Target architecture

- Web: Next.js app deployed to Cloudflare Pages.
- API: Hono-based Cloudflare Worker in `apps/api/src/worker/**`.
- Database: Supabase Postgres accessed from Worker through Cloudflare Hyperdrive using Worker-compatible Prisma adapter/driver.
- Storage: Cloudflare R2 binding for covers and private chapter content.
- Rate limiting/state: Cloudflare KV and/or Cloudflare platform rate limiting, with endpoint-specific parity to Nest throttles.
- Payments: Stripe APIs from Worker, raw-body webhook signature verification preserved.
- Email/push/tracking: Resend, OneSignal, Meta CAPI retained.
- Observability: Sentry retained; Worker/Pages logs and smoke scripts documented.
- Fallback: existing Vercel/Nest path remains documented and deployable until the final cutover gate is approved.

### Runtime gates

1. Prisma/Hyperdrive gate:
   - Replace Node `pg.Pool` runtime dependency for Worker production path.
   - Use `env.HYPERDRIVE.connectionString` through Worker-compatible Prisma adapter/driver.
   - Validate health `SELECT 1`, normal Prisma query, transaction-sensitive write path, JSON fields, and migration compatibility.

2. Auth/cookie gate:
   - Preserve HttpOnly secure cookie auth and refresh behavior.
   - Keep same-site assumptions aligned with `api.novelhub.com` and app domain on same eTLD+1.
   - No browser bearer-token fallback for normal user flows.

3. Commerce gate:
   - Stripe checkout/subscription/coin purchase calls work from Worker.
   - `/payments/webhook` validates raw request body and signature before side effects.
   - Coin balance updates still create `coin_transactions` atomically.

4. Content gate:
   - Private chapters are only accessed through signed/presigned R2 URLs or equivalent protected Worker flow.
   - Cover images remain public through configured host/bucket path.

5. Rate-limit gate:
   - Auth register/login/google, support contact, payment-sensitive endpoints, admin mutations, and public browse endpoints have documented limits.
   - Tests or smoke scripts cover at least representative public and protected limits.

6. CI/e2e gate:
   - Existing Nest/Vercel e2e stays as fallback coverage.
   - Add Cloudflare runtime e2e path that starts Worker-compatible API locally or in staging and exercises Pages-compatible web build.
   - Required flows: health, register/login, browse/free read, paywall, Stripe mocked/test-mode checkout or webhook, admin guard negative case.

7. Ops/cutover gate:
   - Production Hyperdrive id, Worker routes, Pages routes, KV/R2 bindings, secrets, DNS, Stripe webhook endpoint, Sentry DSNs, and smoke URLs are configured.
   - Cutover is reversible; old production path remains until post-cutover smoke succeeds.

## 4. Acceptance criteria

Phase 2 is accepted only when all are true:

- `docs/phase2-final-spec.md` is approved by the human owner.
- Worker API passes typecheck/build and targeted route parity tests.
- Prisma uses the Worker-compatible Hyperdrive path in staging/production, not raw `DATABASE_URL` + Node `pg.Pool` for production Worker traffic.
- Worker health endpoint proves database connectivity in staging.
- Rate-limit parity is documented and validated for high-risk endpoints.
- Cloudflare runtime e2e or smoke pipeline exists and passes against staging.
- Production Cloudflare account resources are configured: Hyperdrive, KV, R2, routes, DNS, Pages, Worker secrets.
- Stripe webhook endpoint is updated/tested in Stripe Dashboard before production commerce traffic moves.
- Runbook contains rollback instructions to return traffic to Vercel/Nest if Cloudflare smoke fails.
- Human approval is recorded before DNS/production route cutover.

## 5. GitHub issue breakdown

### Epic: Phase 2 Cloudflare cutover completion

Deliver Cloudflare Pages + Workers production readiness while preserving Nest/Vercel fallback until smoke passes.

### Issue 1: Rebase migration plan to current repo state

- Replace stale Phase 0/Proposal assumptions with current implemented state.
- Map completed work versus remaining gates.
- Output: updated docs linking this final spec, current branch/PR state, and fallback policy.

### Issue 2: Prisma + Hyperdrive Worker runtime gate

- Swap Worker production DB path from Node `pg.Pool` / `DATABASE_URL` to Worker-compatible Prisma + Hyperdrive.
- Keep local dev strategy explicit.
- Add smoke coverage for health query and representative Prisma operations.

### Issue 3: Worker API behavior parity hardening

- Audit Hono routes against Nest controllers for auth, DTO validation, error shape, cookies, admin guards, Stripe raw webhook, R2 private content, Meta CAPI, email/push side effects.
- Fix parity gaps only; no new product features.

### Issue 4: Rate limiting parity

- Define endpoint-level limits equivalent to current Nest throttling intent.
- Implement via KV/platform rate limiting as appropriate.
- Add tests/smoke for representative public and protected limits.

### Issue 5: Cloudflare Pages/Worker CI and e2e parity

- Add CI path that validates Worker API and Pages-compatible web runtime.
- Keep existing Nest/Vercel e2e as fallback until final cutover.
- Ensure failures upload logs/artifacts useful for rollback decisions.

### Issue 6: Production resource and secrets readiness

- Prepare production Hyperdrive, KV, R2, Pages, Worker routes, secrets, Sentry, Resend, OneSignal, Meta, and Stripe env matrix.
- Separate owner-only dashboard/DNS/Stripe actions from engineer-executable steps.

### Issue 7: Cutover runbook, smoke, rollback

- Update runbook from Phase 1/Vercel-first to Cloudflare cutover-ready.
- Include preflight checklist, DNS cutover steps, post-cutover smoke, rollback, and monitoring.

### Issue 8: Human approval and final production cutover

- Execute only after Issues 1-7 pass.
- Human owner approves DNS/Stripe production changes.
- Perform production cutover and record smoke results.

## 6. Hermes Kanban task graph

Recommended board: `novelhub-phase2`.

- T1 `spec: approve Phase 2 final spec` — assignee `novelhub-orchestrator`; no parents; blocks implementation until approved.
- T2 `db: Prisma Hyperdrive Worker runtime gate` — assignee `novelhub-codex-dev`; parent T1.
- T3 `audit/fix: Worker API behavior parity` — assignee `novelhub-codex-dev`; parent T2.
- T4 `rate-limit: endpoint parity implementation` — assignee `novelhub-codex-dev`; parent T2.
- T5 `ci: Cloudflare Worker/Pages e2e parity` — assignee `novelhub-codex-dev`; parents T2, T3.
- T6 `ops: production resources/secrets checklist` — assignee `novelhub-claude-requirements` or `novelhub-orchestrator`; parent T1; may block on human owner.
- T7 `docs: cutover smoke and rollback runbook` — assignee `novelhub-claude-architect`; parents T5, T6.
- T8 `review: security and production readiness` — assignee `novelhub-claude-reviewer`; parents T3, T4, T5, T7.
- T9 `gate: human production cutover approval` — assignee `novelhub-orchestrator`; parent T8; blocks on owner approval.
- T10 `ops: production cutover execution` — assignee `novelhub-codex-dev` or ops profile; parent T9.

Dependency policy: do not parallelize broad route-porting changes across `apps/api/src/worker.ts`, `apps/api/src/worker/**`, Prisma factory, and package/deploy config until T2 is done. Safe parallel work after T2: rate limiting, docs/runbook, and CI artifact improvements.

## 7. PR sequence

1. PR A — Final spec and planning rebase
   - Adds/updates final spec and issue list.
   - No runtime code changes.
   - Human approval gate before merge or before implementation starts.

2. PR B — Prisma/Hyperdrive runtime gate
   - Worker-compatible DB adapter path.
   - Staging Hyperdrive smoke.
   - This is the highest-risk technical gate.

3. PR C — Worker behavior parity fixes
   - Auth/cookies, validation/error shape, admin guard, Stripe raw webhook, R2 private content, Meta/Resend/OneSignal side effects.

4. PR D — Rate-limit parity
   - Endpoint limit matrix and implementation.
   - Tests/smoke for representative limits.

5. PR E — Cloudflare runtime CI/e2e
   - Worker/Pages validation path.
   - Preserve fallback e2e until production cutover.

6. PR F — Ops readiness and runbook
   - Production secrets/resources checklist.
   - Smoke and rollback procedures.

7. PR G — Production cutover
   - Only after human owner completes Stripe/DNS/dashboard actions and approves final gate.
   - Minimal config/route changes plus recorded smoke output.

## 8. Human approval gates

Gate 1 — Scope approval:

- Approve this final spec and confirm Phase 2 is Cloudflare completion/cutover, not product feature expansion.

Gate 2 — DB runtime gate:

- Approve continuing after Prisma/Hyperdrive smoke passes.
- If it fails materially, keep Nest/Vercel production path and reassess.

Gate 3 — External account readiness:

- Owner confirms Cloudflare production Hyperdrive/routes, DNS access, Stripe Dashboard webhook access, and required secrets are available.

Gate 4 — Staging smoke:

- Worker/Pages staging smoke passes for health, auth, reading/paywall, payment/webhook test path, admin guard, and monitoring.

Gate 5 — Production cutover:

- Owner approves DNS/route/Stripe production changes.
- Rollback owner and time window are identified before changes begin.

Gate 6 — Post-cutover acceptance:

- Production smoke passes.
- Monitoring is live.
- Vercel/Nest fallback remains available for an agreed observation window before decommissioning.

## 9. Fallback policy

If any of these fail after reasonable remediation, stop Cloudflare production cutover and keep the current Vercel/Nest path as production:

- Prisma/Hyperdrive compatibility or connection stability;
- Worker CPU/runtime limits for bcrypt, Stripe webhook signing, R2 upload, or heavy API paths;
- payment/webhook correctness;
- Cloudflare runtime e2e parity;
- owner-only DNS/Stripe prerequisites.

Fallback does not invalidate completed docs, Pages work, or isolated Worker code. It simply prevents moving production traffic until the blocker is resolved or a cheaper Node-hosted backend alternative is chosen.
