# NovelHub Auto-Pipeline

This directory wires Codex (writes code) and Claude (reviews code) into a
mostly-hands-off ticket pipeline.

## What it does

```
You merge PR for ticket NN
  ↓ (next-ticket.yml)
GitHub auto-opens issue "[Ticket NN+1] ..." with @codex mention
  ↓ (Codex Cloud picks up the issue)
Codex opens a PR from feature/<NN+1>-<slug>
  ↓ (claude-review.yml on PR opened)
Claude reads AGENTS.md + ticket file + diff, posts review comment with verdict
  ↓
  ├── APPROVE + non-security ticket → auto-squash-merge
  ├── APPROVE + security ticket (03/05/06/11/14) → label "needs-human-merge", you merge by hand
  └── REQUEST_CHANGES → @codex pinged to fix on same branch (max 3 rounds)
  ↓ (after merge)
back to top
```

## Setup checklist (do these once)

1. **Self-hosted runner with Claude Max auth**: the Claude jobs
   (`correctness_review`, `security_review`, `claude-plan`, `claude-postmerge`)
   call `claude -p` on a self-hosted runner instead of using `ANTHROPIC_API_KEY`.
   This keeps cost on your Claude Max subscription rather than burning API
   credits.
   - Provision a Linux x64 host with the GitHub Actions runner installed
     (`/opt/actions-runner` is conventional). Register it with the label
     `self-hosted-novelhub` against this repo.
   - Install `@anthropic-ai/claude-code` system-wide (`npm install -g
@anthropic-ai/claude-code`) so the runner user finds the `claude` binary.
   - Log in to Claude on that runner user (`sudo -u runner -i claude` then
     follow the OAuth flow) so `~runner/.claude/.credentials.json` exists.
     The CI scripts call `claude -p` non-interactively and rely on those
     credentials being valid.
   - Install the runner as a systemd service (`sudo ./svc.sh install runner`
     and `sudo ./svc.sh start`) so it survives reboots.
   - Verify `gh api repos/<owner>/<repo>/actions/runners --jq '.runners[]'`
     shows the runner as `online` with the `self-hosted-novelhub` label.

2. **Codex Cloud integration**: at https://codex.openai.com, connect this repo
   and enable issue assignment via `@codex` mention. The auto-pipeline assumes
   Codex will pick up issues labeled `codex` / `ticket` / `auto-pipeline`.

3. **Branch protection on `main`** (Settings → Branches → Branch protection rules):
   - Require a pull request before merging: **on**
   - Require approvals: **off** (auto-merge has no human approver)
   - Require status checks to pass: **on**
     - Required check: `Sanity Checks / build`
   - Require conversation resolution: **off**
   - Allow auto-merge: **on**
   - Allow squash merging: **on** (auto-merge uses squash)

4. **Labels**: merging this PR triggers `sync-labels.yml` which creates the
   7 labels the pipeline uses. If you'd rather create them manually, see
   `.github/labels.yml`.

## Operating the pipeline

**Starting it**: open an issue titled `[Ticket 02] Database Schema with Prisma`
with `@codex` in the body (use the body in `START-TICKET-02.md` at repo root —
generated alongside this PR). Codex will pick it up and the pipeline takes over.

**Daily check** (5 min): scan PRs labeled `needs-human-merge` or
`needs-human-review`. Those are the only ones that need you.

- `needs-human-merge`: Claude approved, but the ticket touches money / auth /
  unlock / tracking / launch. Read the diff. Merge if happy.
- `needs-human-review`: 3 review iterations exhausted without APPROVE. Either
  the spec is ambiguous or Codex is stuck. Comment guidance, push fixes
  yourself, or close the PR and re-open the ticket with clearer prompt.

**Pausing**: comment `@github-actions disable` won't work — instead, just close
the open ticket issue. Without an open issue Codex won't pick up new work, and
you can resume by re-opening the issue.

## What's gated behind human merge

The `BLOCKED` env in `claude-review.yml` lists tickets that always require human
merge even if Claude approves:

| Ticket | Why it's gated                                                     |
| ------ | ------------------------------------------------------------------ |
| 03     | Auth — JWT cookie config, bcrypt, OAuth verification               |
| 05     | Coin Unlock — DB transaction atomicity, race conditions            |
| 06     | Stripe — webhook signature verification, idempotency, refund logic |
| 11     | FB CAPI — event_id dedup correctness, hashed user data             |
| 14     | Production deployment — DNS, Stripe live, FB domain verification   |

To enable full auto-merge across all tickets (NOT recommended), set the
`BLOCKED` env to an empty string in `.github/workflows/claude-review.yml`.

## Costs and limits

- Each Claude review: ~$0.05–0.30 with Opus 4.7.
- Max 3 review iterations per PR before the pipeline halts.
- Concurrency-limited per PR: a new push cancels the in-flight review.
- Diff is truncated at 200KB. Larger PRs get a marker but Claude reviews what
  it sees — if a ticket is producing >200KB diffs it should be split anyway.

## Files in this PR

```
.github/
├── labels.yml                          ← label definitions
├── scripts/
│   └── claude_review.py                ← Anthropic SDK call
└── workflows/
    ├── claude-review.yml               ← main: review + auto-merge
    ├── next-ticket.yml                 ← post-merge: open next issue
    ├── sanity-check.yml                ← required status check (lint/test)
    ├── sync-labels.yml                 ← creates the 7 labels
    └── README.md                       ← this file
```
