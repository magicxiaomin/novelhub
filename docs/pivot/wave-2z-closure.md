# Wave 2Z closure ledger

Linked issues: #478, #479, #480, #481, #485, #486

This ledger records the closed Wave 2Z R&D-only work at SHA `f968349`. It is retrospective traceability for the novels-only pivot, not a roadmap, not an ADR, and not a prediction of later-wave work. Evidence below was taken from live `gh pr view` and issue state checks for PRs #482, #483, and #484.

## Parent closure

| Item | Status                                     | Closure evidence                                                                                                                                           |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #478 | Closed                                     | Parent Wave 2Z planning and child execution closed after PRs #482-#484 merged and child issues #479-#481 closed.                                           |
| #485 | Open / superseding architecture resolution | Wave 2AA architect resolution approved this docs-only closure ledger as the first child task and required live merge evidence plus hard-stop preservation. |
| #486 | In progress                                | This ledger is the scoped docs-only child for Wave 2Z closure traceability.                                                                                |

## Merged repository changes

| PR   | Linked issue | Merge SHA | Characterized or documented                                                           | Primary files                                            | Boundary annotation                                                                                                  |
| ---- | ------------ | --------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| #482 | #480         | `7ef3856` | Guarded the locked reader state against accidentally rendering unlocked body content. | `apps/web/src/components/reader/reader-content.spec.tsx` | Test-only R&D characterization; no production source, schema, env, lockfile, dependency, ADR, or `AGENTS.md` change. |
| #483 | #479         | `e786c83` | Characterized `NovelHomePage` loading-state composition and fallback behavior.        | `apps/web/src/components/home/novel-home-page.spec.tsx`  | Test-only R&D characterization; no production source, schema, env, lockfile, dependency, ADR, or `AGENTS.md` change. |
| #484 | #481         | `f968349` | Refreshed the novels funnel coverage snapshot after Wave 2Z merges.                   | `docs/pivot/novels-funnel-coverage.md`                   | Docs-only snapshot refresh; no source, schema, env, lockfile, dependency, ADR, or `AGENTS.md` change.                |

## Residual gaps carried forward

- #418 remains blocked on dependency-policy approval for consent-banner JSDOM/client specs; Wave 2Z did not approve dependencies, add JSDOM helpers, or implement that blocked work.
- #233 remains blocked on external Meta Pixel / CAPI / Stripe verification and the required external evidence; Wave 2Z did not run live payment, Pixel, CAPI, Stape, staging, or production verification.
- Wave 2Z did not resolve or bypass #233 or #418; both stay unresolved and out of scope for this closure ledger.
- Later Wave 2AA work may add audits or non-normative traceability appendices, but this ledger only records the already-merged Wave 2Z baseline.

## Hard stops preserved

- No production deploy, DNS, CDN, certificate, secrets, environment, or staging mutation.
- No live Stripe/payment mutation and no live Meta Pixel / CAPI / Stape verification.
- No destructive DB, data, schema, R2, KV, import, or Prisma migration work.
- No drama reactivation; drama remains quarantined per `docs/pivot/quarantine-register.md`.
- No dependency additions; `pnpm-lock.yaml` remained unchanged by Wave 2Z closure work.
- No changes to `docs/adr/0001-novels-only-pivot.md`; the pivot ADR remains the authority.
- No changes to `AGENTS.md` or repository operating instructions.
