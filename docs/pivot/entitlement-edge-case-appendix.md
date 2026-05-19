# Entitlement edge-case appendix — Non-normative/descriptive only

Linked issues: #467, #471

This appendix describes current NovelHub chapter-entitlement edge cases as they are already represented in `AGENTS.md`, `docs/pivot/funnel.md`, and `docs/pivot/entitlement-matrix.md`. It is descriptive only: it does not define new entitlement behavior, product requirements, schema, data migrations, copy changes, payment handling, tests, or launch-readiness status.

## Source rules summarized

The current novels-only entitlement model remains the four-rule chapter unlock order:

1. Free chapters are readable by anyone, including guests.
2. Paid chapters are readable for a signed-in user with an active subscription.
3. Paid chapters are readable for a signed-in user who already has an individual unlock for that chapter.
4. Otherwise the reader blocks the chapter and shows the paywall.

## Descriptive edge-case inventory

| Edge case                                                                                        | Current descriptive outcome                                                | Source rule(s)                                                      | Notes                                                                                            |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Guest opens a free chapter                                                                       | Readable.                                                                  | Free chapter rule.                                                  | The free chapter rule does not require sign-in.                                                  |
| Guest opens a paid chapter                                                                       | Blocked with paywall.                                                      | Paywall fallback.                                                   | A guest has no signed-in subscription state and no recorded per-user chapter unlock.             |
| Signed-in user opens a free chapter after previously unlocking it                                | Readable because it is free.                                               | Free chapter rule.                                                  | The existing unlock row is not needed for access to the free chapter.                            |
| Signed-in user without subscription opens a paid chapter they individually unlocked              | Readable.                                                                  | Individual unlock rule.                                             | The unlock applies to that user and chapter even without an active subscription.                 |
| Signed-in user with active subscription opens a paid chapter they have not individually unlocked | Readable.                                                                  | Active subscription rule.                                           | The subscription condition is sufficient under the current source rules.                         |
| Signed-in user with both active subscription and individual unlock opens the same paid chapter   | Readable.                                                                  | Active subscription and individual unlock rules.                    | Either readable condition is enough; this appendix does not define precedence side effects.      |
| Signed-in user without active subscription or individual unlock opens a paid chapter             | Blocked with paywall.                                                      | Paywall fallback.                                                   | Authentication alone is not an entitlement.                                                      |
| Subscription no longer represented as active for entitlement purposes                            | Blocked unless an individual chapter unlock exists.                        | Active subscription rule; individual unlock rule; paywall fallback. | The current source rules name active subscriptions as the subscription-based readable condition. |
| Unknown, missing, or non-readable paid chapter entitlement state                                 | Blocked with paywall when none of the readable conditions are established. | Paywall fallback.                                                   | This is a descriptive reading of the fallback rule, not an implementation change.                |

## Non-goals and boundaries

- No code, TypeScript types, runtime entitlement constants, payment logic, database schema, data, R2 content, package manifests, or lockfiles are changed by this appendix.
- No production, external service, Stripe-live, DNS, CDN, certificate, secret, environment, import, or destructive data action is required or authorized by this appendix.
- No short-drama route, episode, media, progress, unlock, or admin behavior is reactivated or changed.
- This appendix does not create new tickets, coverage claims, or product roadmap commitments.
