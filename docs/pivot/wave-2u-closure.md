# Wave 2U closure ledger

Linked issues: #424, #425, #426, #427, #428, #429, #430, #439

This ledger records the closed Wave 2U R&D-only work feeding the Wave 2V plan. It is factual traceability for the novels-only pivot, not a roadmap or ADR.

## Parent closure

| Item | Status | Closure evidence                                                                                                 |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| #424 | Closed | Parent Wave 2U planning and child execution closed after PRs #431-#435 merged and child issues #425-#429 closed. |

## Merged repository changes

| PR   | Linked issue | Characterized or documented                                                          | Changed surface                                                                                                          |
| ---- | ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| #431 | #429         | Added the novels-only pivot surface map and Wave 2T characterization baseline.       | `docs/pivot/funnel.md`                                                                                                   |
| #432 | #427         | Characterized account and balance formatter boundaries.                              | `apps/web/src/lib/formatters.spec.ts`                                                                                    |
| #433 | #426         | Characterized anonymous reading-progress and reader helper edge boundaries.          | `apps/web/src/lib/anonymous-reading-progress.spec.ts`; `apps/web/src/components/reader/reader-content.helpers.spec.ts`   |
| #434 | #425         | Characterized reader pagination, anchors, empty content, and page boundary behavior. | `apps/web/src/app/read/[bookId]/[chapterNumber]/page.spec.tsx`; `apps/web/src/components/reader/reader-content.spec.tsx` |
| #435 | #428         | Extended API reading-progress validation contract coverage.                          | `apps/api/src/worker/routes/reading-progress.contract.spec.ts`                                                           |

## Proposal-only artifact

| Item | Status                  | Boundary                                                                                                                                            |
| ---- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| #430 | Closed as proposal-only | Recorded JSDOM helper options for consent-banner-style client specs; did not add code, dependencies, lockfile changes, or #418 implementation work. |

## Residual gaps carried into Wave 2V

- #418 remains blocked on dependency-policy approval for consent-banner JSDOM/client specs.
- #233 and Kanban `t_030c3f29` remain external launch verification blockers.
- Wave 2V starts from the merged Wave 2U characterization baseline and keeps the same R&D-only hard stops: no production deploy/DNS/CDN/cert/secrets/env, no Stripe live/payment mutation, no destructive DB/data/schema/R2/KV/import, no drama reactivation, and no new dependencies without approval.
