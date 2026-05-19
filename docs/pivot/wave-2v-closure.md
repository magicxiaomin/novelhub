# Wave 2V closure ledger

Linked issues: #436, #437, #438, #439, #440

This ledger records the closed Wave 2V R&D-only work at SHA `ebb2ef4`. It is retrospective traceability for the novels-only pivot, not a roadmap, not an ADR, and not a prediction of later-wave work.

## Parent closure

| Item | Status | Closure evidence                                                                                                                                   |
| ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| #436 | Closed | Parent Wave 2V planning and child execution closed after PRs #441-#444 merged; this ledger only records the Wave 2V baseline that already shipped. |

## Merged repository changes

| PR   | Linked issue | Merge SHA | Characterized or documented                                                                     | Primary files                                                                                                                                                      | Boundary annotation                                                                                    |
| ---- | ------------ | --------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| #441 | #439         | `3bb79bd` | Added the Wave 2U closure ledger and funnel pointer that made Wave 2V planning traceable.       | `docs/pivot/wave-2u-closure.md`; `docs/pivot/funnel.md`                                                                                                            | No new deps / no source change / no ADR change.                                                        |
| #442 | #438         | `3bbd943` | Characterized novels-funnel support surfaces in Node-mode without browser or JSDOM interaction. | `apps/web/src/app/novels/support-surfaces.spec.tsx`                                                                                                                | No new deps / no production source change / no ADR change.                                             |
| #443 | #437         | `645325c` | Added mocked worker-route contract specs for coins, payments, and unlocks.                      | `apps/api/src/worker/routes/coins.contract.spec.ts`; `apps/api/src/worker/routes/payments.contract.spec.ts`; `apps/api/src/worker/routes/unlocks.contract.spec.ts` | No new deps / no production source change / no ADR change.                                             |
| #444 | #440         | `ebb2ef4` | Added a report-only i18n orphan-key audit and script for the shared messages surface.           | `packages/shared/src/audit-i18n-keys.ts`; `packages/shared/src/audit-i18n-keys.spec.ts`; `scripts/audit-i18n-keys.ts`                                              | No new deps / no production source change / no ADR change; open follow-up tracked outside this ledger. |

## Residual gaps carried forward

- #418 / Kanban `t_f06112fb` remains blocked on dependency-policy approval for consent-banner JSDOM/client specs; still blocked and not addressed by Wave 2V.
- #233 / Kanban `t_030c3f29` remains blocked on external Meta Pixel / CAPI / Stripe verification and the required external evidence; still blocked and not addressed by Wave 2V.
- The Wave 2V baseline did not perform production deploy, DNS, CDN, certificate, secrets, environment, live Stripe/payment mutation, live Meta/CAPI verification, destructive DB/data/schema/R2/KV/import, drama reactivation, or dependency changes.

## Hard stops preserved

- No production deploy, DNS, CDN, certificate, secrets, environment, or staging mutation.
- No live Stripe/payment mutation and no live Meta Pixel / CAPI / Stape verification.
- No destructive DB, data, schema, R2, KV, import, or Prisma migration work.
- No drama reactivation; drama remains quarantined per `docs/pivot/quarantine-register.md`.
- No dependency additions; `pnpm-lock.yaml` remained unchanged by Wave 2V closure work.
- No changes to `docs/adr/0001-novels-only-pivot.md`; the pivot ADR remains the authority.
