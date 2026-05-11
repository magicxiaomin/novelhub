# Postmortem: Lessons Learned

This file is the running memory of the auto-pipeline. Each entry is a ≤200-word
lesson distilled by `claude-postmerge.yml` after a `feature/NN-*` PR merges to
`main`. `claude-plan.yml` reads this file when generating the next ticket's
plan, and `claude-review.yml` reads it when reviewing the next PR. The point is
to stop re-discovering the same traps.

Entries are append-only and ordered most-recent-first. Do not edit older entries
to "fix" them — they reflect what we learned at that point in time.

---

## Ticket 14 — feat(web): add drama vertical player and paywall

**What worked:** PR merged successfully via the auto-pipeline.

**Pitfalls hit:** Postmerge analysis could not run — `claude -p` exited 1: no stderr. A human should review the merged diff and append a manual lesson if anything is worth remembering.

**Rule for future tickets:** None recorded for this ticket.

---

## Ticket 01 — Initialize Monorepo and Tooling

**What worked:** pnpm workspace + tsconfig path aliases set up cleanly; eslint
+ prettier + husky wired through; Sanity Checks running on PR.

**Pitfalls hit:**

- **tsconfig path alias gave a false sense of cross-package import.** `apps/api`
  could resolve `@novelhub/db` at *typecheck* time via tsconfig paths, but the
  runtime `import { prisma } from '@novelhub/db'` would fail because the package
  had no real `main` / `exports` entrypoint. Always verify cross-package imports
  with a runtime smoke test (`node -e "require('@novelhub/db')"`), not just a
  green typecheck.
- **husky pre-commit hook blocks any host without pnpm on PATH.** The hook runs
  `pnpm` literally; in environments where pnpm isn't installed (sandbox
  containers, fresh dev machines, CI without setup-node) the commit silently
  fails. Either install pnpm in every workflow before committing, or push via
  GitHub API (which bypasses local hooks).
- **`pnpm install --frozen-lockfile` fails the moment any `package.json`
  changes.** When adding a new workspace dependency, the lockfile MUST be
  refreshed with `--no-frozen-lockfile` first and the updated `pnpm-lock.yaml`
  committed in the same PR. Don't expect frozen-install to "auto-fix" mismatch.

**Rule for future tickets:** any cross-package import gets a runtime smoke
test in CI; lockfile updates ride with the dependency PR they enable.
