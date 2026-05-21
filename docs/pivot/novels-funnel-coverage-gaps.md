# Novels funnel coverage gap analysis

Source snapshot: current `main` at `97a7964c59a35caa0c911ac603835248c7b0c655`, using `docs/pivot/novels-funnel-coverage.md` as the factual source of truth. That source document describes its factual coverage snapshot as of `924eaaf07403d5c23c960c00adfbb76bdadbf2a0`.

Parent planning issue: #632. Child issue: #635.

This document is descriptive, non-binding planning analysis. It does not rewrite the factual snapshot, create implementation commitments, change ADR direction, alter the novels-only funnel, or reopen drama surfaces. Future characterization candidates below are prioritized planning inputs only.

External launch verification remains out of scope: #233 / Kanban `t_030c3f29` was not probed, unblocked, bypassed, or reinterpreted for this analysis.

## Assessment scale

- Covered: the factual snapshot lists direct unit, contract, e2e, or closure-ledger evidence for the stage.
- Partially covered: the factual snapshot lists meaningful evidence, but the stage still has seams where future characterization could reduce ambiguity.
- Not covered: the factual snapshot lists no direct repository characterization for the stage.

## Canonical funnel stage assessment

| Stage           | Coverage assessment | Snapshot evidence summary                                                                                                                                                                                                                                                                                                                           | Remaining planning gap                                                                                                                                                                                       | Priority for future characterization |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Ad landing      | Covered             | Home, novels discovery, landing-page, and novel-funnel e2e specs are listed: `apps/web/src/app/page.spec.ts`, `apps/web/src/components/home/novel-home-page.spec.tsx`, `apps/web/src/app/novels/page.spec.ts`, and `tests/e2e/specs/novel-funnel.spec.ts`.                                                                                          | Coverage is broad for repository surfaces, but campaign-specific ad-link variants and external acquisition wiring remain outside repository characterization. Do not treat this as #233 launch evidence.     | P2                                   |
| Novel detail    | Covered             | Book detail, metadata, JSON-LD, reader metadata, and funnel e2e specs are listed, including post-2Y static-render characterization in `apps/web/src/app/book/[id]/page.spec.ts`.                                                                                                                                                                    | Detail-to-reader handoff appears covered; future work could characterize unusual metadata or empty-state combinations if product risk increases.                                                             | P3                                   |
| Free chapters   | Covered             | Reader page specs, reader helpers, anonymous progress, reading-progress e2e, chapters worker contracts, and books worker contracts are listed, including optional-auth and DTO-shape characterizations.                                                                                                                                             | Free-reading behavior is represented across web and worker seams; future candidates should focus only on newly discovered boundary ambiguity, not broad retesting.                                           | P3                                   |
| Paywall         | Covered             | Paywall e2e, return-url e2e, reader page/content specs, unlock worker contracts, and Paywall component specs are listed, including PR #535 checkout-edge cases, PR #576 visible labels, PR #617 reader-to-paywall seam evidence, and PR #630 `unlockOptions` invariance.                                                                            | Existing evidence is strong at component and repository seams. Remaining risk is end-to-end payment-provider reality, which is deliberately excluded from this document and from #233 probing.               | P2                                   |
| Purchase/unlock | Partially covered   | Query, payments webhook, payments/coins/unlocks worker contracts, and payments/coins/unlocks service specs are listed, including `/coins` route-contract gap-fill from PR #547.                                                                                                                                                                     | Repository contracts and service behavior are covered, but live Stripe, Meta, production/staging, credentials, webhooks in real environments, and external purchase telemetry are not covered here.          | P1                                   |
| Library         | Covered             | Resume-reading card, history e2e, auth worker-route characterization, reading-progress worker contracts/validation, and reading-progress service specs are listed. Issue #641 adds `/me` entitlement-reflection characterization for active subscription, individual-unlock-as-progress, no-entitlement/empty-progress, and unauthenticated states. | Recovery surfaces now have repository coverage for current `/me`, resume-reading, and continue-reading behavior. No `/library` route, new entitlement states, or subscription logic changes were introduced. | P3                                   |

## Prioritized future characterization candidates

These candidates are non-binding. They are ordered by planning value if a future planning wave decides additional repository characterization is worthwhile.

### P1: Purchase/unlock repository seam consolidation

Candidate scope: characterize the repository-level handoff among checkout creation, unlock completion, coin balance display, and post-payment return surfaces using mocks only.

Why: the purchase/unlock stage is the canonical monetization seam. The factual snapshot lists many service and worker tests, but a future narrow characterization could make the web-to-worker expectations easier to audit without touching Stripe, live payments, databases, R2, or production/staging systems.

Out of scope for this candidate: live Stripe calls, Meta Pixel/CAPI calls, webhook delivery from external systems, real credentials, schema changes, seed/import/data changes, and #233 / Kanban `t_030c3f29` verification.

### P3: Library entitlement reflection maintenance

Current Issue #641 characterization covers how existing `/me`, resume-reading, and continue-reading surfaces reflect active subscription access, individual unlocks represented through reading-progress rows, no-entitlement/empty-progress states, and unauthenticated access using mocks only.

Future scope: refresh these tests only if the existing `/me`, resume-reading, or continue-reading surfaces change. A standalone `/library` route, new entitlement states, data model changes, subscription logic changes, drama shelf reactivation, and production data inspection remain out of scope for this gap-analysis lane.

### P2: Ad landing to paywall campaign-context preservation

Candidate scope: characterize only repository-local routing/context preservation from landing/discovery into detail, free chapter, and paywall return context.

Why: ad landing is covered as a surface, and paywall return context is covered separately. A future narrow characterization could make the acquisition-to-lock boundary easier to reason about while keeping external ad platforms out of scope.

Out of scope for this candidate: Facebook Ads, Meta Pixel/CAPI, Stape, production campaign URLs, DNS/CDN/cert changes, or any live acquisition verification.

### P3: Novel detail edge cases

Candidate scope: characterize unusual but repository-local book detail states, such as missing optional metadata, empty chapter lists, or unavailable cover metadata, if those states become product risks.

Why: the detail stage is already covered; this is a lower-priority defensive candidate rather than an identified active gap.

Out of scope for this candidate: new product requirements, SEO strategy changes, or ADR direction changes.

### P3: Free chapter boundary regression guardrails

Candidate scope: add or refresh narrow tests only if future changes make guest sampling, optional auth, or locked-boundary behavior ambiguous.

Why: the free-chapter stage currently has strong reader, anonymous progress, e2e, chapters-contract, and books-contract coverage.

Out of scope for this candidate: broad retesting of already-covered behavior or any production reader traffic inspection.

## Non-goals and hard exclusions preserved

This gap analysis does not:

- Modify code, tests, schema, data, imports, R2 objects, production, staging, DNS, CDN, certificates, secrets, Stripe, Meta, Stape, or environment configuration.
- Reactivate, redirect toward, or reinterpret short-drama surfaces.
- Probe, unblock, satisfy, or bypass #233 / Kanban `t_030c3f29` external launch verification.
- Change `docs/adr/0001-novels-only-pivot.md`, `docs/pivot/funnel.md`, or any ADR/product direction.
- Create tickets or implementation commitments by itself.
