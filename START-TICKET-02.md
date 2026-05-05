# Starting the pipeline: Ticket 02

After this PR is merged and the auto-pipeline is set up (see
`.github/workflows/README.md`), open an issue manually to kick things off.
The pipeline only auto-creates Tickets 03-14 after a merge; Ticket 02 needs
a one-time manual nudge.

## How to start

```bash
gh issue create \
  --title "[Ticket 02] Database Schema with Prisma" \
  --label "codex,ticket,auto-pipeline" \
  --assignee "chatgpt-codex-connector[bot]" \
  --body-file START-TICKET-02.md
```

Or paste the body below into a new issue at
https://github.com/magicxiaomin/novelhub/issues/new and assign it to
`chatgpt-codex-connector[bot]`.

---

@codex

Implement Ticket 02.

**Read first (in full):**

- `AGENTS.md` - project conventions, strict
- `docs/tickets/02-database-schema.md` - the ticket itself

**Steps:**

1. Create branch `feature/02-database-schema` from latest `main`
2. Set up Prisma with PostgreSQL provider in `packages/db`
3. Define the complete schema EXACTLY as specified in the ticket - all 10 models (User, Book, Chapter, ReadingProgress, ChapterUnlock, CoinTransaction, Subscription, Order, DailyCheckin, FbEvent), every index, every unique constraint, every relation
4. Add a seed script with 3 books, 30 chapters total (10 per book), and 1 admin user
5. Make sure Prisma Client is exported so `apps/api` can `import { prisma } from '@novelhub/db'` at runtime (not just under a tsconfig path alias - actual package resolution must work)
6. Add a real smoke test in `apps/api` that imports prisma from `@novelhub/db` to prove the cross-package import resolves
7. Update root pnpm scripts so `pnpm --filter @novelhub/db prisma:migrate dev` and `pnpm --filter @novelhub/db prisma:seed` both work
8. Run `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test` and paste real output (not "all green") into the PR description
9. Open a PR titled `feat(db): Database Schema with Prisma`, linking `docs/tickets/02-database-schema.md`

**Constraints:**

- Stay strictly within ticket scope. Do not start on auth (Ticket 03) or any other module.
- No `any` types without a justifying comment.
- No new dependencies beyond Prisma + seed tooling unless flagged in PR description with reason.
- Do NOT modify the schema after this ticket without going through a new ticket - downstream tickets depend on these exact field names.
- Stop and ask if anything is ambiguous BEFORE coding (especially the ReadingProgress unique constraints which have to handle both userId and guestId cases).

**In the PR description, also answer:**

- What edge cases did you consider? (especially soft-delete + unique constraints on email and stripeSubscriptionId)
- What in this ticket is most likely to break in production?

After you push, Claude will auto-review on PR open. If changes are requested, address every numbered fix in that review and push to the same branch - review will re-run automatically (max 3 iterations).
