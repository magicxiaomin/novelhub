# NovelHub Phase 2 Execution Environment

Status: orchestrator environment scaffolded for PR #104.

## Source documents in PR #104

- Proposal v1: `docs/phase2-proposal-v1.md`
- Final Spec: `docs/phase2-final-spec.md`
- Agent workflow: `docs/phase2-agent-workflow.md`

PR: https://github.com/magicxiaomin/novelhub/pull/104

## GitHub Epic + Issues

GitHub issue creation is pending GitHub CLI authentication on this host. `gh auth status` currently reports: `You are not logged into any GitHub hosts`.

When GitHub auth is available, create the following Epic and issues from the Final Spec.

### Epic: Phase 2 Cloudflare cutover completion

Goal: deliver Cloudflare Pages + Workers production readiness while preserving the Nest/Vercel fallback until smoke passes.

Labels: `type:epic`, `phase:2`, `area:cloudflare`, `status:needs-spec`, `priority:p0`

Acceptance criteria:

- Tracks Issues 1-8 below.
- Links PR #104 as the planning/spec PR.
- Links the `novelhub-phase2` Hermes Kanban graph.
- Records human approval before implementation children start.

### Issue 1: Rebase migration plan to current repo state

Labels: `type:task`, `phase:2`, `area:docs`, `area:cloudflare`, `priority:p1`

Acceptance criteria:

- Replace stale Phase 0 / Proposal assumptions with current implemented state.
- Map completed work versus remaining gates.
- Link `docs/phase2-final-spec.md`, PR #104, current branch/PR state, and fallback policy.
- No runtime code changes.

Kanban: `t_f0943d98` for approval gate plus follow-up docs task if needed.

### Issue 2: Prisma + Hyperdrive Worker runtime gate

Labels: `type:feature`, `phase:2`, `area:api`, `area:database`, `area:cloudflare`, `priority:p0`

Acceptance criteria:

- Worker production DB path uses Worker-compatible Prisma + Hyperdrive, not raw `DATABASE_URL` + Node `pg.Pool` for production Worker traffic.
- Staging/Worker health proves DB connectivity with `SELECT 1`.
- Representative Prisma read/write, transaction-sensitive path, JSON field, and migration compatibility are tested or documented.
- No schema changes without separate human approval.
- PR includes test plan, linked issue, and Kanban task id.

Kanban: `t_6e31a401`

### Issue 3: Worker API behavior parity hardening

Labels: `type:feature`, `phase:2`, `area:api`, `area:cloudflare`, `priority:p0`

Acceptance criteria:

- Hono Worker routes are audited against Nest controllers for auth, DTO validation, error shape, cookies, admin guards, Stripe raw webhook, R2 private content, Meta CAPI, Resend, and OneSignal side effects.
- Critical parity gaps are fixed or explicitly escalated to architect/human decision.
- No new product features or schema changes.
- PR includes route parity matrix, test plan, linked issue, and Kanban task id.

Kanban: `t_01e27270`

### Issue 4: Rate limiting parity

Labels: `type:feature`, `phase:2`, `area:api`, `area:security`, `area:cloudflare`, `priority:p1`

Acceptance criteria:

- Endpoint-level limits are documented for auth register/login/google, support contact, payment-sensitive endpoints, admin mutations, and public browse endpoints.
- Cloudflare-compatible KV/platform rate-limit strategy is implemented or explicitly justified.
- Representative public and protected limit tests/smoke pass.
- PR includes limit matrix, test plan, linked issue, and Kanban task id.

Kanban: `t_9357f5ab`

### Issue 5: Cloudflare Pages/Worker CI and e2e parity

Labels: `type:feature`, `phase:2`, `area:ci`, `area:web`, `area:api`, `area:cloudflare`, `priority:p0`

Acceptance criteria:

- Existing Nest/Vercel e2e remains as fallback coverage.
- Cloudflare runtime e2e/smoke path validates health, register/login, browse/free read, paywall, Stripe mocked/test-mode checkout or webhook, and admin guard negative case.
- CI uploads useful logs/artifacts for failure diagnosis.
- PR includes test plan, linked issue, and Kanban task id.

Kanban: `t_338e5574`

### Issue 6: Production resource and secrets readiness

Labels: `type:task`, `phase:2`, `area:ops`, `area:cloudflare`, `priority:p0`, `status:blocked`

Acceptance criteria:

- Production Hyperdrive, KV, R2, Pages, Worker routes, secrets, Sentry, Resend, OneSignal, Meta, and Stripe env matrix is documented.
- Owner-only dashboard/DNS/Stripe actions are separated from engineer-executable steps.
- Human blockers are explicit before cutover.
- No secrets are committed.

Kanban: `t_1db47133`

### Issue 7: Cutover runbook, smoke, rollback

Labels: `type:task`, `phase:2`, `area:docs`, `area:ops`, `area:cloudflare`, `priority:p0`

Acceptance criteria:

- Runbook includes preflight checklist, DNS cutover steps, Stripe webhook rotation, post-cutover smoke, monitoring, rollback, and observation window.
- Vercel/Nest fallback remains available until post-cutover acceptance.
- Human approval gates are explicit.

Kanban: `t_d473d120`

### Issue 8: Human approval and final production cutover

Labels: `type:task`, `phase:2`, `area:ops`, `area:cloudflare`, `priority:p0`, `status:blocked`

Acceptance criteria:

- Issues 1-7 are complete or explicitly waived by the human owner.
- Security/production readiness review is complete.
- Human owner approves DNS/route/Stripe production changes and rollback owner/window.
- Production smoke evidence is recorded.

Kanban: `t_ffc9598c`, `t_03dd9302`

## Hermes Kanban execution graph

Board: `novelhub-phase2`

Completed CCR tasks:

- `t_69980add` — `novelhub-claude-requirements` — CCR-1 Proposal v1
- `t_ecbb2c1b` — `novelhub-codex-feasibility` — CCR-2 feasibility review
- `t_61c12a89` — `novelhub-claude-architect` — CCR-3 Final Spec

Execution tasks:

- `t_f0943d98` — `novelhub-orchestrator` — gate: approve Phase 2 final spec — blocked on human approval
- `t_6e31a401` — `novelhub-codex-dev` — db: Prisma Hyperdrive Worker runtime gate — parent `t_f0943d98`
- `t_01e27270` — `novelhub-codex-dev` — audit/fix: Worker API behavior parity — parent `t_6e31a401`
- `t_9357f5ab` — `novelhub-codex-dev` — rate-limit: endpoint parity implementation — parent `t_6e31a401`
- `t_1db47133` — `novelhub-claude-requirements` — ops: production resources and secrets checklist — parent `t_f0943d98`
- `t_338e5574` — `novelhub-codex-dev` — ci: Cloudflare Worker/Pages e2e parity — parents `t_6e31a401`, `t_01e27270`
- `t_d473d120` — `novelhub-claude-architect` — docs: cutover smoke and rollback runbook — parents `t_338e5574`, `t_1db47133`
- `t_2415f631` — `novelhub-claude-reviewer` — review: security and production readiness — parents `t_01e27270`, `t_9357f5ab`, `t_338e5574`, `t_d473d120`
- `t_ffc9598c` — `novelhub-orchestrator` — gate: human production cutover approval — parent `t_2415f631`
- `t_03dd9302` — `novelhub-codex-dev` — ops: production cutover execution — parent `t_ffc9598c`

## Profile role map

All NovelHub profiles currently use Hermes model `gpt-5.5` via provider `openai-codex` with `agent.reasoning_effort: low`. The profile name defines the workflow role; the local Claude Code CLI is not authenticated on this host, so Claude-named profiles are role/persona profiles unless Claude Code login is completed.

- `novelhub-orchestrator`: PM/dispatcher. Owns Issue <-> Kanban <-> PR traceability. Does not implement.
- `novelhub-claude-requirements`: requirements owner. Produces Proposal v1, assumptions, scope, user stories, acceptance criteria, and human clarification gates.
- `novelhub-codex-feasibility`: repo-grounded engineering challenger. Produces APPROVE / REVISE / BLOCK with Critical/Important/Minor findings. Does not implement.
- `novelhub-claude-architect`: final spec decision maker. Resolves feasibility findings and writes PRD/spec/issues/Kanban graph. Does not implement before approval.
- `novelhub-codex-dev`: implementation worker. Works only from approved GitHub Issue + Kanban acceptance criteria in isolated worktrees.
- `novelhub-claude-reviewer`: final PR reviewer. Reviews spec compliance, code quality, security, tests, docs, and project rules. Does not fix code directly.

## Required next gates

1. Authenticate GitHub CLI or provide a token so the Epic + Issues can be created on GitHub.
2. Commit/push this PR #104 update.
3. Human approves or changes `docs/phase2-final-spec.md`.
4. After approval, unblock `t_f0943d98` and dispatch implementation tasks.
