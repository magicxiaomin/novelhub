# Entitlement decision matrix

Linked issues: #458, #459

This is a snapshot reference for the current novels-only chapter entitlement model. It consolidates the existing rules from `AGENTS.md` and `docs/pivot/funnel.md`; it does not change product behavior, runtime code, database schema, payment handling, copy, or tests.

## Sources

- `AGENTS.md` → Important Domain Rules → Chapter Unlock Logic:
  1. If `chapter.is_free`, the chapter is readable by anyone, including guests.
  2. If the user has an active subscription, the chapter is readable.
  3. If the user already unlocked this chapter in `chapter_unlocks`, the chapter is readable.
  4. Otherwise the chapter is blocked and the reader shows the paywall.
- `docs/pivot/funnel.md` → Entitlement rules carried forward: the novels-only funnel keeps the same four-rule chapter unlock model.
- `docs/pivot/novels-funnel-coverage.md` → Current coverage snapshot for free chapters, paywall, purchase/unlock, and library/account recovery surfaces.

## Decision order

Evaluate a chapter request in this order:

1. Free chapter check: when `chapter.is_free` is true, allow reading for every reader state.
2. Active subscription check: when the chapter is paid and the signed-in user has an active subscription, allow reading while the subscription is active.
3. Individual unlock check: when the chapter is paid and the signed-in user has already unlocked that chapter, allow reading for that user.
4. Paywall fallback: when none of the readable conditions apply, block the chapter and show the reader paywall.

## Matrix

| Reader state                                                          | Free chapter outcome                                              | Paid chapter outcome                                                                              | Source rule                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Guest / anonymous reader                                              | Readable. Free chapters are readable by anyone, including guests. | Paywall. A guest has no active subscription and no recorded individual unlock.                    | `AGENTS.md` Chapter Unlock Logic rules 1 and 4; `docs/pivot/funnel.md` lines 54-61. |
| Authenticated reader without active subscription or individual unlock | Readable. Free chapters remain readable after sign-in.            | Paywall. Authentication alone does not unlock a paid chapter.                                     | `AGENTS.md` Chapter Unlock Logic rules 1 and 4; `docs/pivot/funnel.md` lines 54-61. |
| Authenticated reader with an individual unlock for this chapter       | Readable. Free chapter access does not depend on the unlock row.  | Readable. The existing `chapter_unlocks` record grants access to this paid chapter for that user. | `AGENTS.md` Chapter Unlock Logic rules 1 and 3; `docs/pivot/funnel.md` lines 54-61. |
| Authenticated reader with active subscription                         | Readable. Free chapter access remains open.                       | Readable. Active subscriptions unlock paid chapters while active.                                 | `AGENTS.md` Chapter Unlock Logic rules 1 and 2; `docs/pivot/funnel.md` lines 54-61. |

## Coverage reference

The entitlement-related coverage snapshot is recorded in `docs/pivot/novels-funnel-coverage.md`:

- Free chapters: `apps/web/src/app/read/[bookId]/[chapterNumber]/page.spec.tsx`, reader helper specs, anonymous progress specs, e2e reading-progress specs, and worker route contracts for books/chapters.
- Paywall: `tests/e2e/specs/paywall.spec.ts`, `tests/e2e/specs/paywall-return-url.spec.ts`, reader page specs, and `apps/api/src/worker/routes/unlocks.contract.spec.ts`.
- Purchase/unlock: payment webhook, payment/coin/unlock worker contracts, and payment/coin/unlock service specs.
- Library/account recovery: resume-reading, history, reading-progress, and account subscription coverage.

This document is not a new coverage claim and does not create new gap tickets.

For a non-normative descriptive appendix of current entitlement edge cases, see `docs/pivot/entitlement-edge-case-appendix.md`. For non-normative matrix-row traceability against existing coverage references, see `docs/pivot/entitlement-matrix-traceability.md`.

## Preserved blockers and exclusions

- #233 / Kanban `t_030c3f29` remains the external launch verification blocker for Meta/Pixel/CAPI/Stripe/staging checks. This matrix does not resolve or bypass it.
- #418 / Kanban `t_f06112fb` remains the consent-banner JSDOM/client coverage dependency-policy blocker. This matrix does not resolve or bypass it.
- Drama routes, episode playback, drama unlocks, drama progress, drama admin, and drama media remain out-of-funnel for the novels-only pivot per `docs/pivot/quarantine-register.md`.
- No code, entitlement constants, TypeScript types, package manifests, lockfiles, runtime payment behavior, Stripe configuration, secrets, environment variables, database schema, R2 data, or production infrastructure are changed by this snapshot.
