# Wave 2AF closure ledger

Linked issues: #521, #522, #523, #524, #233, #418

This ledger records the closed Wave 2AF R&D-only work at SHAs `969e503`, `6700a1f`, and `6fb0fb0`. It is retrospective traceability for the novels-only pivot, not a roadmap, not an ADR, and not a prediction of later-wave work. Evidence below was taken from live `gh pr view` and issue state checks for PRs #525, #526, and #527 and issues #521, #522, #523, #524, #233, #418, and #528.

## Parent closure

| Item | Status | Closure evidence                                                                                                             |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| #521 | Closed | Parent Wave 2AF R&D-only planning closed after child issues #522, #523, and #524 closed and PRs #525, #526, and #527 merged. |
| #522 | Closed | Wave 2AF child for the Wave 2AE closure ledger; closed by merged PR #525 at `969e503`.                                       |
| #523 | Closed | Wave 2AF child for MeResumeReadingCard edge-case characterization; closed by merged PR #526 at `6700a1f`.                    |
| #524 | Closed | Wave 2AF child for the novels funnel coverage snapshot refresh; closed by merged PR #527 at `6fb0fb0`.                       |

## Merged repository changes

| PR   | Linked issue | Merge SHA | Characterized or documented                                                                                                                                                                                                                                                                                    | Primary files                                         | Boundary annotation                                                                                                                                       |
| ---- | ------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #525 | #522         | `969e503` | Added `docs/pivot/wave-2ae-closure.md`, recording live evidence for Wave 2AE issues #515/#516/#517, merged PRs #519/#520, adjacent PR #518, residual #233/#418 context, and the hard stops preserved by Wave 2AE.                                                                                              | `docs/pivot/wave-2ae-closure.md`                      | Docs-only retrospective traceability; no source, schema, environment, lockfile, dependency, ADR, `AGENTS.md`, payment/data/R2/import, or drama change.    |
| #526 | #523         | `6700a1f` | Characterized MeResumeReadingCard fractional progress rounding, current unclamped out-of-range and `NaN` scroll-percent rendering, reserved-character `bookId` href encoding parity, and positional `entries[0]` precedence over `updatedAt`.                                                                  | `apps/web/src/app/me/me-resume-reading-card.spec.tsx` | Test-only R&D characterization of current behavior; component source unchanged, no new dependency or JSDOM helper, and no entitlement/ownership language. |
| #527 | #524         | `6fb0fb0` | Refreshed `docs/pivot/novels-funnel-coverage.md` to the post-2AF-2 merge SHA, added the Wave 2AE closure reference, reclassified consent coverage through live #418/#518 evidence, preserved #233 as the only active external blocker, and confirmed the Library row still cites the resume-reading-card spec. | `docs/pivot/novels-funnel-coverage.md`                | Docs-only factual snapshot; no roadmap, new gap tickets, behavior, source, schema, environment, lockfile, dependency, ADR, or `AGENTS.md` change.         |

## Adjacent non-2AF context

PR #518 (`75f282a`) is adjacent context only and is not part of Wave 2AF. Live `gh pr view 518` and `gh issue view 418` evidence shows it closed #418 by adding consent-banner transition characterization with human-approved narrow web test devDependencies (`jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`) and lockfile updates. Wave 2AF only referenced that live state while refreshing the funnel snapshot; it did not reclassify PR #518 or #418 into Wave 2AF scope.

Issue #528 is the next Wave 2AG planning lane and remained open in live `gh issue view` evidence when this ledger was written. It is not Wave 2AF scope.

## Residual gaps carried forward

- #233 remains open as the external Meta Pixel / CAPI / Stripe test-mode verification blocker; Wave 2AF did not run live or staging payment, Pixel, CAPI, Stape, or production verification and did not post the required external evidence report.
- #418 live state is closed by adjacent PR #518 (`75f282a`), not by Wave 2AF. Wave 2AF carried that state into `docs/pivot/novels-funnel-coverage.md` as adjacent-resolved consent coverage while preserving the wave boundary.
- Wave 2AF did not resolve or bypass #233 and did not absorb PR #518 into the Wave 2AF closure set.
- Later waves may add non-normative traceability appendices or follow-up audits, but this ledger only records the already-merged Wave 2AF baseline and explicitly adjacent #418/#518 context.

## Hard stops preserved

- No production deploy, DNS, CDN, certificate, secrets, environment, or staging mutation.
- No live Stripe/payment mutation and no live Meta Pixel / CAPI / Stape verification.
- No destructive DB, data, schema, R2, KV, import, or Prisma migration work.
- No drama reactivation; drama remains quarantined per `docs/pivot/quarantine-register.md`.
- No dependency additions by Wave 2AF; `pnpm-lock.yaml` remained unchanged by PRs #525, #526, and #527.
- No changes to `docs/adr/0001-novels-only-pivot.md`; the pivot ADR remains the authority.
- No changes to `AGENTS.md` or repository operating instructions.
