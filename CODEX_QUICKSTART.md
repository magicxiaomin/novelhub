# Codex Quickstart Guide

How to drive this project with OpenAI Codex (or Claude Code / Cursor).

## 1. Initial Setup

1. Unzip this skeleton into an empty directory
2. `git init` and make initial commit
3. Push to your GitHub repo
4. Connect repo to Codex (or open in your AI IDE)

## 2. Per-Ticket Workflow

For **each** ticket from `docs/tickets/01-*.md` through `14-*.md`, in order:

### Prompt to start a ticket

```
Read AGENTS.md for project standards.
Then read docs/tickets/<TICKET-FILE>.md.

Your job: implement everything described in that ticket.
- Create a branch named `feature/<id>-<short-slug>`
- Follow all standards in AGENTS.md
- Write tests as required
- Run lint, typecheck, and tests before declaring done
- Open a PR with title `feat(<scope>): <ticket title>` and a summary of changes

Do NOT do work outside the scope of this ticket.
Stop and ask if anything in the ticket is ambiguous.
```

### After Codex finishes

Verify before merging:

1. Pull the branch locally and run:
   ```bash
   pnpm install
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
2. Manual smoke test of the new feature
3. Read the diff carefully — Codex sometimes adds unnecessary code
4. Ask Codex two follow-up questions:
   - "What edge cases did you consider for this ticket?"
   - "What in this ticket is the most likely to break in production?"

If anything is wrong, give specific feedback and ask for a fix. Don't move to the next ticket until current one is solid.

## 3. Recommended Ticket Cadence

| Phase | Tickets | Days |
|-------|---------|------|
| Foundation | 01–02 | 1 |
| Backend core | 03–06 | 6 |
| Frontend core | 07–09 | 5–6 |
| Retention & growth | 10–12 | 4 |
| Polish | 13–14 | 4 |

**Total: ~20 working days for a full-stack engineer**, longer if working part-time.

## 4. Things Codex Should NOT Decide on Its Own

When Codex hits these decisions, it should stop and ask you:

- Adding any new dependency not listed in AGENTS.md
- Changing tech stack (DB, framework, etc.)
- Changing ticket scope
- Modifying the Prisma schema after Ticket 02
- Renaming env variables
- Changing API contracts that other tickets depend on
- Anything legal-text related (privacy policy, ToS, refund policy)

## 5. Common Codex Pitfalls in This Project

Watch for these — they happen often:

1. **Forgets `'use client'`** — Next.js 14 App Router defaults to Server Components. Hooks/event handlers need `'use client'` at the top.
2. **Uses `any` to bypass TS errors** — Reject this. Make it fix types properly.
3. **Skips tests** — Always check there are tests for new code.
4. **Hardcodes prices/URLs** — Should be in `packages/shared` constants.
5. **Forgets webhook signature verification** — Critical for Stripe.
6. **Missing CAPI dedup IDs** — `event_id` must be passed end-to-end.
7. **Locks chapter content endpoint** — Free chapters must be readable by guests too.
8. **Generates real legal text** — Should leave placeholders for human review.

## 6. After All 14 Tickets Done

- Buy domain, set up Cloudflare DNS
- Register Stripe live mode account, configure webhook
- Set up FB Business Manager, verify domain, configure Pixel
- Set up OneSignal app
- Set up Resend account, configure DNS records (SPF, DKIM)
- Upload first 15 novels via admin panel
- Test live $1 Stripe purchase end-to-end (refund after)
- Run final QA checklist from Ticket 14
- Start FB ad with $50/day testing budget

Good luck!
