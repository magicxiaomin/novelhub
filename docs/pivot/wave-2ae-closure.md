# Wave 2AE closure ledger

Linked issues: #515, #516, #517, #233, #418

This ledger records the closed Wave 2AE R&D-only work at SHAs `c4f5b66` and `04521dd`. It is retrospective traceability for the novels-only pivot, not a roadmap, not an ADR, and not a prediction of later-wave work. Evidence below was taken from live `gh pr view` and issue state checks for PRs #519 and #520 and issues #515, #516, #517, #233, and #418.

## Parent closure

| Item | Status | Closure evidence                                                                                               |
| ---- | ------ | -------------------------------------------------------------------------------------------------------------- |
| #515 | Closed | Parent Wave 2AE R&D-only planning closed after child issues #516 and #517 closed and PRs #519 and #520 merged. |
| #516 | Closed | Wave 2AE child for novels entry handoff characterization; closed by merged PR #520 at `04521dd`.               |
| #517 | Closed | Wave 2AE child for reader boundary edge-case characterization; closed by merged PR #519 at `c4f5b66`.          |

## Merged repository changes

| PR   | Linked issue | Merge SHA | Characterized or documented                                                                                                                                                                                               | Primary files                                                                                                                              | Boundary annotation                                                                                                                                  |
| ---- | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| #519 | #517         | `c4f5b66` | Characterized locked `ChapterResponse` handoff into `ReaderContent`, invalid chapter number metadata handling, and locked reader handoff to `Paywall` with `currentUrl` while cross-referencing 2AD payment return tests. | `apps/web/src/app/read/[bookId]/[chapterNumber]/page.spec.tsx`; `apps/web/src/components/reader/reader-content.spec.tsx`                   | Test-only R&D characterization; no production/source behavior, dependency, secrets/env, payment/data/schema/R2/import, or drama reactivation change. |
| #520 | #516         | `04521dd` | Characterized home featured/trending/new release handoffs to current book detail and novels discovery links, novels index card/filter handoffs, and book detail route-id/first-chapter read-entry handoff.                | `apps/web/src/components/home/novel-home-page.spec.tsx`; `apps/web/src/app/novels/page.spec.ts`; `apps/web/src/app/book/[id]/page.spec.ts` | Test-only R&D characterization; no production/source behavior change and no campaign/ad redirect route or `novelId` query parser behavior invented.  |

## Adjacent non-2AE context

PR #518 (`75f282a`) is adjacent context only and is not part of Wave 2AE. Live `gh pr view 518` evidence shows it closed #418 by adding consent-banner transition characterization with human-approved narrow web test devDependencies (`jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`) and lockfile updates. Those dependency and consent-banner changes belong to Wave 2T / issue #418, not to Wave 2AE, and this ledger does not reclassify them as 2AE scope.

## Residual gaps carried forward

- #233 remains open as the external Meta Pixel / CAPI / Stripe test-mode verification blocker; Wave 2AE did not run live or staging payment, Pixel, CAPI, Stape, or production verification and did not post the required external evidence report.
- #418 live state is closed by adjacent PR #518 (`75f282a`), not by Wave 2AE. Wave 2AE preserved #418 as out of scope while its own PR bodies still referenced the then-open consent/JSDOM dependency-policy item as excluded work.
- Wave 2AE did not resolve or bypass #233 and did not absorb PR #518 into the Wave 2AE closure set.
- Later waves may add non-normative traceability appendices or follow-up audits, but this ledger only records the already-merged Wave 2AE baseline and the explicitly adjacent #418 context.

## Hard stops preserved

- No production deploy, DNS, CDN, certificate, secrets, environment, or staging mutation.
- No live Stripe/payment mutation and no live Meta Pixel / CAPI / Stape verification.
- No destructive DB, data, schema, R2, KV, import, or Prisma migration work.
- No drama reactivation; drama remains quarantined per `docs/pivot/quarantine-register.md`.
- No dependency additions by Wave 2AE; `pnpm-lock.yaml` remained unchanged by PRs #519 and #520.
- No changes to `docs/adr/0001-novels-only-pivot.md`; the pivot ADR remains the authority.
- No changes to `AGENTS.md` or repository operating instructions.
