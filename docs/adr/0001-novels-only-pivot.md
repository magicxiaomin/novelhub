# ADR 0001: Novels-only pivot

Status: Accepted
Date: 2026-05-14
Linked issues: #195, #196

## Context

NovelHub's original product direction is a mobile-first English web novel PWA for paid acquisition. Phase 3 introduced short-drama experiments under DramaVela routes, APIs, database tables, media fixtures, admin surfaces, and smoke checks. The current business direction is to return the product to a focused novels-only funnel before further production launch work.

This ADR records the first non-destructive pivot decision. It does not delete drama code, tables, assets, media, data, secrets, DNS, or payment configuration. It creates a durable decision boundary for follow-up tickets to hide or gate drama behavior safely while preserving evidence and rollback options.

## Decision

NovelHub will prioritize a novels-only acquisition and monetization funnel:

1. Paid/social ad landing routes users into novel discovery or a specific novel detail page.
2. Users read free novel chapters before encountering a chapter paywall.
3. Locked chapters are unlocked with an active subscription or coin purchase.
4. Purchased/unlocked novels and chapters remain accessible from the reader/library experience.

Short-drama functionality is quarantined. Quarantine means retain source artifacts for audit and rollback, hide or gate runtime access where follow-up tickets explicitly require it, and avoid destructive removal until a separately approved data/schema/media cleanup plan exists.

## Consequences

- Product, QA, and launch documentation should treat novels as the only active customer-facing funnel.
- Drama-specific routes, endpoints, tests, admin tools, fixtures, media packs, and database tables must be classified before follow-up implementation changes.
- Follow-up implementation must prefer feature flags, explicit product-mode helpers, route hiding, and test quarantine over deletion.
- Existing drama work remains available for reference and possible future revival, but should not drive launch readiness.
- Documentation and PRs for the pivot must link back to #195 and the child implementation issues for traceability.

## Alternatives considered

### Keep novels and drama as parallel products

Rejected for this wave. Parallel funnels increase QA, analytics, operations, media, and support scope while the current launch objective is a focused novels-only product.

### Delete all drama code/data/media immediately

Rejected. Destructive deletion is outside this ticket and outside the #195 safety boundary. It risks losing useful implementation history and may require production DB, R2, DNS, or payment changes that need a separate approval gate.

### Keep drama publicly accessible but de-emphasized

Rejected for the pivot. A hidden-but-reachable drama product can still leak through direct URLs, API clients, admin actions, smoke checks, or search/indexing paths. Follow-up tickets should explicitly gate or hide runtime access where needed.

## Rollback / reactivation path

The pivot is intentionally reversible because this first wave is docs-only and non-destructive. To reactivate drama later:

1. Approve a new GitHub issue/ADR that names the desired drama surface area.
2. Review `docs/pivot/quarantine-register.md` and change entries from `hide`/`gate` to `retain` or implementation tasks.
3. Re-enable product-mode routing and tests in a branch with explicit QA coverage.
4. Verify database schema, media storage, admin workflows, smoke checks, analytics, and payment behavior before production exposure.

## Hard stops

Do not perform any of the following under this ADR or #196:

- Destructive production database changes, data deletion, or schema drops.
- R2/media deletion or bucket rewrites.
- Stripe live configuration, live payment, or secret changes.
- DNS, domain, certificate, CDN, or production cutover changes.
- Production `PRODUCT_MODE=novels` cutover without a separate approved gate.
- Broad product-code behavior changes beyond explicitly approved follow-up tickets.
