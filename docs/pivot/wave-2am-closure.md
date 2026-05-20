# Wave 2AM closure ledger

Linked issues: #587, #586, #580, #581, #582, #233, #566

This ledger is a retrospective closure and audit record for Wave 2AM. It records the closed Wave 2AM child issues #580, #581, and #582 plus merged PRs #583, #584, and #585. It is not an ADR, roadmap, launch approval, production-readiness claim, production-auth-readiness claim, live-payment-readiness claim, external tracking-verification artifact, staging-import-readiness claim, directive, or gap-ticket source.

## Merged evidence ledger

| PR   | Merged evidence                                                                                                                                                   | Wave 2AM record                                                                   | Primary file(s)                                    | Boundary annotation                                                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #583 | Merged at `2026-05-20T19:22:41Z` as merge commit `502fa9bf2eca1c33c23c841f60750d907c9c03af`; GitHub title: `docs(pivot): add Wave 2AL closure ledger`.            | Wave 2AM-A evidence: Wave 2AL closure-ledger record.                              | `docs/pivot/wave-2al-closure.md`                   | Docs-only retrospective ledger for the previous wave. It preserved #233 / Kanban `t_030c3f29` as open external launch-verification context and did not add production, staging, schema, data, Stripe, credential, or runtime evidence.      |
| #584 | Merged at `2026-05-20T20:09:09Z` as merge commit `9d54af288d79cdf703536a77cf4579477bbb96f9`; GitHub title: `test(api): characterize worker auth route contracts`. | Wave 2AM-B evidence: mocked Worker auth route-contract characterization only.     | `apps/api/src/worker/routes/auth.contract.spec.ts` | Test-only mocked Worker route-contract characterization. It is not production auth readiness, live user/session evidence, credential evidence, staging evidence, launch readiness, or a change to auth policy or production behavior.       |
| #585 | Merged at `2026-05-20T21:15:27Z` as merge commit `c770c52e783ab323cc9e354a9c5a82aecc89183d`; GitHub title: `docs(pivot): refresh Wave 2AM funnel coverage`.       | Wave 2AM-D evidence: canonical novels funnel coverage snapshot refresh after A/B. | `docs/pivot/novels-funnel-coverage.md`             | Docs-only coverage refresh. It records PR #584 as mocked auth-route evidence and preserves the canonical map snapshot pin at `9d54af288d79cdf703536a77cf4579477bbb96f9`; it does not create new coverage claims beyond repository evidence. |

## Closed Wave 2AM issues

| Issue | Closure evidence                                                                                                      | Scope recorded here                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| #580  | Closed at `2026-05-20T19:22:43Z`; GitHub title: `docs(pivot): add Wave 2AL closure ledger`.                           | Closed by the Wave 2AL retrospective closure ledger recorded in PR #583.              |
| #581  | Closed at `2026-05-20T20:09:11Z`; GitHub title: `test(api): characterize worker auth route contracts`.                | Closed by the mocked Worker auth route-contract characterization recorded in PR #584. |
| #582  | Closed at `2026-05-20T21:15:29Z`; GitHub title: `docs(pivot): refresh canonical novels funnel coverage for Wave 2AM`. | Closed by the canonical novels funnel coverage refresh recorded in PR #585.           |

## Canonical map snapshot pin

PR #585 refreshed `docs/pivot/novels-funnel-coverage.md` after Wave 2AM-A/B and deliberately preserved the snapshot pin at `9d54af288d79cdf703536a77cf4579477bbb96f9`. That pin is the PR #584 merge commit for the mocked Worker auth route-contract characterization.

This ledger does not move, reinterpret, or expand that snapshot. The canonical funnel coverage map remains a repository-evidence snapshot, not a production launch, live traffic, staging import, payment, credential, or third-party verification claim.

## #233 external launch-verification blocker preserved

Issue #233 (`[Wave 2A][P0] tracking-testmode-verification`) remains open. Kanban task `t_030c3f29` remains the preserved external launch-verification blocker context for that issue.

The preserved #233 scope is external evidence, not repository characterization:

- Browser Pixel evidence for `PageView`, `ViewContent`, `InitiateCheckout`, and test `Purchase` / `Subscribe` paths.
- Server CAPI evidence from staging `fb_events` rows.
- Matching frontend/backend event IDs proving deduplication for at least one funnel event.
- Stripe test-mode/webhook fixture evidence only, with no live payment or production mutation.

None of PR #583, PR #584, PR #585, or this ledger closes, resolves, unblocks, changes, or supplies the external launch-verification evidence required by #233 / Kanban `t_030c3f29`.

## #566 staging admin import boundary preserved

Issue #566 (`Fix staging admin chapter import for real public-domain books`) remains separate staging admin import work. Wave 2AM did not perform staging writes, staging imports, destructive data changes, R2 mutations, production imports, schema changes, migrations, or real public-domain book ingestion.

This ledger does not claim staging import readiness and does not alter #566 scope. Any future #566 work remains outside this retrospective closure record and requires its own approved issue, acceptance criteria, human gates, and staging-safe execution path.

## Hard exclusions preserved

The Wave 2AM closure boundary preserves these hard exclusions:

- No production deploy, DNS, CDN, certificate, secrets, environment, credential, or runtime configuration changes.
- No live Stripe/payment mutation, live subscription purchase, live coin purchase, live webhook mutation, or live payment-readiness claim.
- No destructive database, data, schema, Prisma migration, R2, KV, import, staging write, production write, or staging-import-readiness claim.
- No third-party credential, Meta Pixel, CAPI, Stape, Stripe, Vercel, Railway, Supabase, R2, Resend, OneSignal, or Sentry credential change.
- No #233 unblock, closure, scope change, evidence substitution, or external launch-verification bypass.
- No #566 staging write, staging import, production import, data backfill, or readiness claim.
- No drama reactivation; drama remains quarantined under `docs/pivot/quarantine-register.md`.
- No roadmap approval, ADR update, new directive, new gap ticket, or new coverage claim beyond the verified repository evidence listed above.

## Audit conclusion

Wave 2AM closed as a bounded repository-evidence wave: PR #583 recorded the Wave 2AL closure ledger, PR #584 added mocked Worker auth route-contract characterization only, and PR #585 refreshed the canonical novels funnel coverage snapshot while preserving the map snapshot pin at `9d54af288d79cdf703536a77cf4579477bbb96f9`. Issues #580, #581, and #582 are closed; #233 / Kanban `t_030c3f29` remains open external launch-verification context; and #566 remains separate staging admin import work.
