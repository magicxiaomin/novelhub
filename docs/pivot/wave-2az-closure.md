# Wave 2AZ closure ledger

Parent issue: #651. Child issues: #648, #649, #652. Kanban tasks: `t_d73da8e1`, `t_4b659cf4`.

This ledger is the Wave 2AZ retrospective closure and audit record. It is descriptive, reversible, non-production R&D documentation only. It does not change runtime behavior, product requirements, payment handling, database/schema/data/R2 state, deployment, secrets, Stripe/Meta/Stape integrations, or launch-readiness status. External launch verification remains blocked outside this wave at #233 / Kanban `t_030c3f29` and was not probed, unblocked, satisfied, or bypassed.

## Merged evidence ledger

| PR      | Merged evidence                                                                                                                                                      | Wave 2AZ record                                                                                    | Primary file(s)                                                                                                                                        | Boundary annotation                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #650    | Merged at `2026-05-21T19:10:59Z` as merge commit `4e56f0762deef1cbe1fe79f3fe3444dc13f2d0b4`; GitHub title: `test(web): characterize route acquisition context drop`. | Wave 2AZ-A route-level acquisition-context current-behavior characterization for issues #648/#649. | `apps/web/src/app/book/[id]/page.spec.ts`, `apps/web/src/app/read/[bookId]/[chapterNumber]/page.spec.tsx`, `docs/pivot/novels-funnel-coverage-gaps.md` | Mock-only repository characterization that book-detail read-entry hrefs remain canonical `/read/{bookId}/{chapter}` URLs without acquisition query keys, and that ReaderPage passes a canonical path-only `ReaderContent.currentUrl` derived from route params rather than fabricated `searchParams`. This is descriptive only; it does not implement campaign preservation or verify Facebook Ads, Meta Pixel/CAPI, Stape, DNS/CDN/cert, staging, production, or external acquisition paths. |
| this PR | SHA-backed closure and coverage refresh for issue #652.                                                                                                              | Wave 2AZ closure ledger refresh and factual coverage snapshot update after PR #650 merged.         | `docs/pivot/wave-2az-closure.md`, `docs/pivot/novels-funnel-coverage.md`                                                                               | Docs-only retrospective refresh based on verified merged PR #650 evidence. It confirms #233 / Kanban `t_030c3f29` remains untouched, records Wave 2BA-B as deferred with no issue opened, and does not create new gap tickets, roadmap directives, ADR changes, launch approval, or external verification evidence.                                                                                                                                                                           |

## Candidate A — route-level acquisition-context characterization

PR #650 added current-behavior coverage for the remaining repository-local acquisition context handoffs after Wave 2AY-C. `apps/web/src/app/book/[id]/page.spec.ts` documents that book-detail read-entry hrefs stay canonical and omit unsupported acquisition query keys such as `utm_source`, `utm_medium`, `utm_campaign`, `fbclid`, `campaign`, and `ad_id`. `apps/web/src/app/read/[bookId]/[chapterNumber]/page.spec.tsx` documents that ReaderPage derives `ReaderContent.currentUrl` from canonical route params and does not fabricate or preserve acquisition `searchParams` for the reader-to-paywall handoff.

The characterization is intentionally descriptive. It does not add campaign-preservation behavior, alter canonical URL generation, change paywall checkout semantics, call external acquisition/payment systems, or provide launch-readiness evidence.

## Deferred/non-recorded work

Wave 2AZ-B and Wave 2AZ-C have no merged implementation evidence in this closure ledger. The architect resolution for Wave 2BA records 2BA-B as deferred with no issue opened, so this closure refresh does not create or imply a 2BA-B ticket, follow-up task, ADR, roadmap item, or implementation commitment.

## Coverage refresh conclusion

`docs/pivot/novels-funnel-coverage.md` is refreshed only with verified merged PR #650 evidence, and its snapshot SHA is updated to `4e56f0762deef1cbe1fe79f3fe3444dc13f2d0b4`, the merge commit for PR #650 now on `main`. The refresh remains factual and does not create new planning commitments.

## Validation for this docs-only PR

- `pnpm exec prettier --check docs/pivot/wave-2az-closure.md docs/pivot/novels-funnel-coverage.md`
- `pnpm format:check`

## Hard exclusions confirmed

No production deploy, DNS/CDN/cert, secrets/env, live or test-mode Stripe/payment calls, webhook delivery, destructive DB/data/schema/migration/R2/import action, staging/production mutation, drama reactivation, or #233 / `t_030c3f29` probing was performed for Wave 2AZ-A or this closure refresh.
