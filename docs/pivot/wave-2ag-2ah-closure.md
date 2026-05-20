# Wave 2AG / Wave 2AH closure audit ledger

Linked issues: #542, #543, #539, #538, #233

This ledger is a retrospective closure and audit record for the Wave 2AG / Wave 2AH handoff reviewed under parent issue #542 and implementation issue #543. It is not an ADR, roadmap, launch approval, production readiness claim, or external evidence artifact. Evidence below is from GitHub PR and issue state checks for PRs #540 and #541 and issue #233.

## Attribution-by-content rule

Wave attribution in this ledger follows the actual merged repository content, not only the PR title. If a PR title conflicts with the file changed and body summary, the changed file and body summary decide the wave attribution.

Applied here:

- PR #540 is recorded as a Wave 2AG novels funnel snapshot refresh because it changed only `docs/pivot/novels-funnel-coverage.md` and its PR body says it refreshed that document to the current Wave 2AG docs snapshot SHA while preserving #233.
- PR #540 is not recorded as delivered Wave 2AH coverage, despite the phrase "Wave 2AH" in its PR title.
- PR #541 is recorded as Wave 2AH unlock-route contract characterization because it changed `apps/api/src/worker/routes/unlocks.contract.spec.ts` and characterized worker unlock route contracts.

## Merged evidence ledger

| PR   | Merged evidence                                                                                                                                                                                                          | Attribution in this ledger                          | Primary file(s)                                       | Boundary annotation                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #540 | Merged at `2026-05-20T08:01:39Z` as merge commit `498bbac2a78028e0f5f80b5a3b41ed841b0e36ed`; GitHub title: `docs(pivot): refresh Wave 2AH funnel coverage snapshot`; PR body references Wave 2AG snapshot SHA `6d79473`. | Wave 2AG funnel snapshot refresh by actual content. | `docs/pivot/novels-funnel-coverage.md`                | Docs-only snapshot refresh; explicitly preserved #233; no production deploy, no live payment/tracking evidence, no schema/data/R2/import, no drama reactivation.                                              |
| #541 | Merged at `2026-05-20T08:25:37Z` as merge commit `1bc4a42666fd14c5b80d7fda4063e47662eb68f3`; GitHub title: `test(api): characterize unlock worker route contracts`.                                                      | Wave 2AH unlock-route contract characterization.    | `apps/api/src/worker/routes/unlocks.contract.spec.ts` | Test-only R&D characterization of the Hono worker route boundary with in-memory Prisma stubs; not proof of real PostgreSQL transaction isolation, real concurrency, staging behavior, or production behavior. |

## Dedicated PR #540 title/content discrepancy

PR #540 has a title/content discrepancy: the GitHub title says `docs(pivot): refresh Wave 2AH funnel coverage snapshot`, but the actual diff and PR body show a docs-only refresh of `docs/pivot/novels-funnel-coverage.md` to the Wave 2AG docs snapshot.

For audit purposes, this ledger resolves that discrepancy by content:

1. The only file changed by PR #540 was `docs/pivot/novels-funnel-coverage.md`.
2. The PR body states it refreshed that document to the current Wave 2AG docs snapshot SHA (`6d79473`).
3. The PR body preserved #233 as unresolved/deferred external launch verification.
4. Therefore PR #540 is Wave 2AG funnel snapshot refresh evidence only.
5. PR #540 must not be cited as delivering Wave 2AH unlock-route coverage or any Wave 2AH behavioral characterization.

## #233 external launch-verification blocker preserved

Issue #233 (`[Wave 2A][P0] tracking-testmode-verification`) remains open and deferred. Kanban task `t_030c3f29` remains the preserved external launch-verification blocker context for that issue.

The open #233 scope is external evidence, not repository characterization:

- Browser Pixel evidence for `PageView`, `ViewContent`, `InitiateCheckout`, and test `Purchase` / `Subscribe` paths.
- Server CAPI evidence from staging `fb_events` rows.
- Matching frontend/backend event IDs proving deduplication for at least one funnel event.
- Stripe test-mode/webhook fixture evidence only, with no live payment or production mutation.

Neither PR #540 nor PR #541 closes, resolves, bypasses, or supplies the external evidence required by #233. This ledger also does not close, resolve, bypass, or supply that evidence.

## Hard stops preserved

The Wave 2AG / Wave 2AH audit boundary preserves these hard stops:

- No production deploy, DNS, CDN, certificate, secrets, environment, or staging mutation.
- No live Stripe/payment mutation and no live Meta Pixel, CAPI, Stape, or tracking verification evidence.
- No destructive database, data, schema, R2, KV, import, or Prisma migration work.
- No drama reactivation; drama remains quarantined under `docs/pivot/quarantine-register.md`.
- No launch approval, production-readiness approval, roadmap approval, or ADR update.
- No claim that PR #540 delivered Wave 2AH coverage.

## Audit conclusion

The closed repository evidence separates cleanly by content: PR #540 is Wave 2AG docs snapshot evidence, and PR #541 is Wave 2AH unlock-route contract characterization evidence. The external launch-verification blocker #233 / Kanban `t_030c3f29` remains open and deferred, and all production, payment, tracking, schema/data/R2/import, and drama-reactivation hard stops remain preserved.
