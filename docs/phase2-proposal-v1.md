# NovelHub Phase 2 Proposal v1

## Restated requirement

Start the controlled Phase 2 CCR workflow for NovelHub. Using the current repository documents as source of truth, summarize the current product and architecture state, then produce a Phase 2 proposal suitable for Codex feasibility review. This is requirements/planning only; no code implementation is in scope.

Sources inspected:

- `AGENTS.md`
- `docs/prd.md`
- `docs/architecture.md`
- `docs/phase2-agent-workflow.md`
- `docs/tickets/README.md`
- `docs/runbook.md`
- `docs/cloudflare-migration-phase0.md`
- `docs/tickets/01-monorepo-setup.md` through `docs/tickets/14-deployment-qa.md`

Note: Claude Code was attempted first per profile routing, but the local CLI returned `Not logged in · Please run /login`; this proposal was completed directly from repository evidence.

## Current product / architecture state

NovelHub is a mobile-first English web novel PWA designed for paid acquisition, especially Meta/Facebook ads. The intended journey is: ad landing -> free chapters -> paywall -> registration/login -> subscription or coin purchase -> continued reading and retention. Core monetization is Stripe subscriptions and one-time coin packages. Core KPIs in the PRD are landing-to-register >= 30%, register-to-first-purchase >= 5%, first-purchase ARPU >= $15, and D7 ROAS >= 0.8 (`docs/prd.md`).

The canonical MVP stack in `AGENTS.md` and `docs/prd.md` is Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui for web, NestJS + Prisma + PostgreSQL for API/data, Redis cache, Cloudflare R2 for chapter content, Stripe for payments, Resend for email, OneSignal for push, Meta Pixel + CAPI for tracking, and Sentry for monitoring.

`docs/architecture.md` states the production feature set defined by tickets 01-13 is merged into `main`, and ticket 14 adds deployment/QA and operations documentation. It also captures key boundaries: JWT in HttpOnly secure cookies, Stripe raw body preservation for `/payments/webhook`, private chapter content via API-issued presigned R2 URLs, admin routes guarded by JWT + AdminGuard, and frontend server components/React Query/Zustand/messages-based strings.

`docs/runbook.md` records a Phase 1 low-cost launch path with both apps on Vercel, Supabase Postgres, R2, Stripe, Meta, Sentry, UptimeRobot, and GitHub Actions migrations. It also states a Cloudflare cutover is in progress as of 2026-05-08 and pending project-owner Stripe Dashboard and DNS access.

`docs/cloudflare-migration-phase0.md` is the most concrete Phase 2 candidate. It proposes a Cloudflare full rewrite/migration: web to Cloudflare Pages, API to Cloudflare Workers with Hono, Supabase retained behind Hyperdrive, R2 retained, Stripe/Meta/Sentry/OneSignal/Resend retained, and Vercel/Railway dropped from the main path. It says this migration was confirmed as Option B, with Workers paid plan, DNS layout, bcrypt cost, document location, and local-dev parity decisions already recorded. It also provides an API inventory, critical behavior parity chains, target Workers tech stack, risk list, and a 19-task breakdown.

The active workflow for this Phase 2 work is defined in `docs/phase2-agent-workflow.md`: requirements owner writes Proposal v1; Codex feasibility reviewer returns APPROVE/REVISE/BLOCK; Claude architect resolves findings and writes Final Spec; human approval is required before implementation.

## Clarifying questions and assumptions

### Clarifying questions for human / architect

1. Is the Cloudflare full rewrite/migration in `docs/cloudflare-migration-phase0.md` the intended Phase 2 scope for this CCR, or should Phase 2 include product growth features beyond infrastructure migration?
2. If Cloudflare migration is the scope, is Task 1 spike (`spike/prisma-workers`) authorized as the first feasibility gate before any larger implementation plan proceeds?
3. Has the project owner completed, or can they soon complete, the external account prerequisites called out in the runbook: Cloudflare account/project setup, Stripe Dashboard webhook access, DNS registrar access, and required GitHub Actions secrets?
4. Should the existing NestJS API remain runnable during migration until the final cutover, as `docs/cloudflare-migration-phase0.md` proposes, or is a hard branch rewrite acceptable?
5. What is the required production domain shape for launch: `app.novelhub.com` + `api.novelhub.com` + `cdn.novelhub.com`, apex web + API subdomain, or another domain layout?
6. Should Phase 2 preserve every MVP behavior byte-for-byte, or may the architect authorize intentional API/UX changes if Cloudflare constraints make parity expensive?
7. Does the team want GitHub Issues created per Cloudflare migration task now, or only after Final Spec approval?

### Assumptions for Proposal v1

- Phase 2 means the Cloudflare migration/cutover described in `docs/cloudflare-migration-phase0.md`, not a new product-feature expansion.
- MVP product behavior and monetization do not change in Phase 2.
- Database schema remains unchanged unless Codex feasibility review proves a blocker.
- The Phase 2 process must follow the CCR gates in `docs/phase2-agent-workflow.md`.
- Human approval is required before implementation tasks begin.
- Work will be delivered in isolated worktrees under `/root/novelhub-worktrees/<slug>` when implementation starts.

## Scope

Phase 2 Proposal v1 scope:

1. Validate the Cloudflare migration path before implementation.
2. Preserve current MVP product behavior: browsing, reading, paywall, auth, coins, subscription, checkout, tracking, push, admin, support, legal, and smoke tests.
3. Move runtime architecture from the Phase 1 Vercel/NestJS deployment path toward Cloudflare Pages + Cloudflare Workers/Hono while keeping Supabase, R2, Stripe, Meta, Sentry, OneSignal, and Resend.
4. Keep operational cutover explicit: staging smoke, Stripe webhook rotation, DNS cutover, production smoke, Vercel teardown only after confidence.
5. Use the existing Phase 2 multi-agent CCR workflow before code implementation.
6. Let Codex feasibility review challenge repo reality, especially around Cloudflare Workers compatibility, test coverage, CI gates, and task split.

## Non-goals

- No code implementation in CCR-1.
- No schema redesign unless a feasibility blocker forces a later architecture decision.
- No new NovelHub product features such as comments, ratings, bookshelf/favorites, multilanguage, invite/referral, native apps, ad-rewarded unlocks, or marketing automation.
- No monetization/pricing changes unless requested by the human.
- No replacement of Stripe, OneSignal, Resend, Meta Pixel/CAPI, Supabase, or R2.
- No live DNS, Stripe, Cloudflare, or production secret changes during requirements drafting.
- No direct edits to tickets 01-14 acceptance criteria as part of this task.

## User stories

### Reader acquisition and monetization parity

- As a guest arriving from a Facebook ad, I can land on a book or chapter page, read free chapters, and encounter the same paywall behavior after the free limit.
- As a new user, I can register or log in from the paywall and return to the reading flow without losing intent.
- As a paying reader, I can buy coins or subscribe through Stripe and receive access according to existing unlock rules.
- As a subscriber, I retain unlimited reading access while active, past_due in grace, or canceled but still within the paid period.

### Retention and operational parity

- As a returning reader, my reading progress and check-in coin rewards continue to work after migration.
- As a user who grants push permission, I can receive the one-time bonus and later retention notifications.
- As a marketer/operator, Meta Pixel and backend CAPI events keep consistent `event_id` deduplication and purchase/subscription source-of-truth semantics.
- As an admin, I can manage books, chapters, users, orders, uploads, and broadcasts with the same admin protections.

### Engineering and launch control

- As a developer, I can run a Cloudflare-compatible local/staging environment and verify critical flows before production cutover.
- As an operator, I can cut over DNS and Stripe webhooks in clear stages with rollback or pause points.
- As a reviewer, I can map each Phase 2 PR back to a requirements-approved task and verification gate.

## Acceptance criteria

### Requirements / CCR gate

- Proposal v1 exists and includes current state, scope, non-goals, clarifying questions, user stories, acceptance criteria, implications, risks, and Codex review instructions.
- Proposal cites repository documents as source of truth.
- Proposal does not implement code.
- Major unresolved decisions are listed explicitly for human/architect resolution.
- Codex feasibility review task can consume this proposal and return APPROVE / REVISE / BLOCK.

### Feasibility gate before implementation

- Codex reviews this proposal against the live repo and identifies blockers, complexity, test gaps, and overengineering risks.
- Architect resolves every Codex finding as Adopted / Rejected / Modified before Final Spec.
- Human approves Final Spec before any implementation task begins.

### Phase 2 implementation acceptance criteria, if approved later

- The first implementation step is a spike proving Prisma driver adapter + Hyperdrive compatibility for `SELECT 1`, representative Prisma queries, transactions with isolation level, advisory locks, and JSON columns.
- Existing MVP behavior parity is preserved across all 13 business-critical chains listed in `docs/cloudflare-migration-phase0.md`.
- No database schema changes occur unless approved through Final Spec.
- API route auth/throttle semantics are preserved or explicitly documented and approved if changed.
- Stripe webhook signature verification works with Workers-compatible raw body handling and `constructEventAsync`.
- R2 signed chapter URLs keep 1-hour expiry and private chapter-content behavior.
- Cookie auth remains HttpOnly, secure in production, same site/domain appropriate for the approved DNS layout, and never moves to localStorage.
- Meta purchase/subscription server-side events remain source of truth and dedupe with browser events where applicable.
- Existing automated checks pass: lint, typecheck, backend tests, relevant frontend tests, and smoke script.
- Staging Worker/Page smoke passes before production DNS cutover.
- Stripe webhook URL and signing secret rotation are coordinated and verified before live traffic depends on them.
- Vercel teardown occurs only after Cloudflare production smoke passes and the operator approves.

## UX / API / data implications

### UX implications

- Reader-facing UX should remain unchanged: landing pages, reader, paywall, auth modal, account, recharge, legal pages, PWA install, and push permission flows should not be redesigned during migration.
- Performance may improve from edge deployment, but Cloudflare Pages/Workers constraints could affect SSR, image optimization, and cold-start behavior. These must be measured rather than assumed.
- If approved DNS is `app.novelhub.com` and `api.novelhub.com`, cookie behavior must be tested on Safari/iOS and Android Chrome because auth continuity is core to checkout and reader conversion.

### API implications

- NestJS controllers/guards/interceptors/DTO validators would be translated to Hono route modules, middleware, and Zod schemas if the migration proceeds.
- API route shapes, status codes, response envelopes, auth requirements, and throttling should be parity-gated.
- Stripe webhook raw body handling changes implementation mechanism but not external endpoint behavior.
- Vercel Cron HTTP endpoints would be replaced by Cloudflare scheduled handlers; public cron routes and `CRON_SECRET` behavior should be removed only after equivalent scheduled coverage is proven.
- Swagger/OpenAPI annotations from NestJS will not transfer automatically; architect must decide whether Phase 2 requires regenerated OpenAPI documentation or accepts temporary loss during migration.

### Data implications

- Prisma schema should stay unchanged.
- Supabase remains the database; Hyperdrive becomes the Workers connection layer.
- Migrations must run from GitHub Actions against a direct Supabase URL, not Hyperdrive.
- Coin transaction invariants remain mandatory: every balance change creates a `coin_transactions` row and atomic spend/grant behavior is preserved.
- `chapter_unlocks`, subscriptions, orders, webhook events, and `fb_events` retain existing idempotency assumptions.
- R2 object layout remains unchanged for covers and chapters.

## Risks and open decisions

### Release-blocking risks

1. Prisma + Hyperdrive + driver adapter compatibility may fail in ways that invalidate the proposed Workers architecture.
2. bcryptjs cost factor 12 may exceed acceptable Workers CPU budget under real request conditions.
3. Stripe webhook signature verification parity may break if raw body handling is wrong.
4. Admin multipart chapter upload may exceed Workers request/body/CPU limits for 10 MB uploads.
5. Cookie/auth behavior may fail if final DNS layout differs from assumptions.
6. Loss of NestJS Swagger/OpenAPI generation may be unacceptable for operational needs unless replaced.

### Important risks

1. Translating class-validator DTOs to Zod is broad and error-prone; parity tests are required.
2. Replacing Redis/ioredis behavior with KV/no-op cache may alter rate-limit or cache behavior if not narrowly scoped.
3. Sentry behavior differs between Node and Cloudflare; user context and source maps need verification.
4. Next.js on Cloudflare Pages via `@cloudflare/next-on-pages` may expose SSR/RSC constraints.
5. Removing Vercel Analytics and standalone output could have build/deploy side effects.
6. Production cutover depends on external dashboard access and correct secret handling.

### Open decisions

- Confirm Phase 2 scope as Cloudflare migration only vs. broader product expansion.
- Decide whether OpenAPI/Swagger parity is a Phase 2 acceptance criterion.
- Decide whether to create one GitHub Issue per Cloudflare migration task before or after Final Spec approval.
- Decide final DNS layout and cookie settings.
- Decide whether Cloudflare paid Workers plan is definitively approved for production.
- Decide who performs manual Stripe/DNS/Cloudflare dashboard steps and when.

## Proposal v1 for Codex feasibility review

Codex should review this proposal against the real repo and return APPROVE / REVISE / BLOCK.

Recommended review focus:

1. Validate whether `docs/cloudflare-migration-phase0.md` still matches current repo state after recent commits on branch `chore/phase2-agent-workflow`.
2. Confirm the 19-task Cloudflare breakdown is still feasible and correctly sequenced.
3. Identify all repo areas that contradict or complicate a NestJS-to-Hono migration.
4. Check whether tests currently cover the claimed 13 business-critical chains strongly enough to serve as parity gates.
5. Verify whether `@cloudflare/next-on-pages`, Prisma driver adapters, Hyperdrive, R2 bindings, `aws4fetch`, Sentry Cloudflare, and Stripe `constructEventAsync` are compatible with the existing package versions and TypeScript setup.
6. Challenge any overengineering: if a narrower Phase 2 scope would achieve the business goal with less risk, state it clearly.
7. Identify where GitHub Issues and kanban tasks should be split, serialized, or allowed to run in parallel.
8. Flag any required human decisions that should block implementation.

Preliminary recommendation: REVISE before implementation, not because the plan is invalid, but because Codex feasibility review and human/architect confirmation are required by the workflow. The highest-value immediate next step is the Prisma + Hyperdrive driver-adapter spike. If that spike fails, the Worker rewrite should pause and architecture options should be reopened.
