#!/usr/bin/env python3
"""Run a Claude review against a PR diff and emit Markdown to stdout.

Reads:
  $TICKET_FILE  — path to ticket markdown (e.g. docs/tickets/02-database-schema.md)
  $TICKET_NUM   — two-digit ticket number (e.g. "02")
  /tmp/pr.diff.trimmed — the unified diff to review (capped at ~200KB upstream)
  AGENTS.md, the ticket file (relative to repo root)

Writes:
  Markdown review to stdout. Last line of the heading "### Verdict:" must be
  exactly one of APPROVE / REQUEST_CHANGES / COMMENT.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from anthropic import Anthropic, AnthropicError

REPO_ROOT = Path(__file__).resolve().parents[2]
SECURITY_TICKETS = {"03", "05", "06", "11"}
MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-7")
MAX_TOKENS = int(os.environ.get("CLAUDE_MAX_TOKENS", "4096"))


def read(path: str) -> str:
    full = REPO_ROOT / path
    return full.read_text(encoding="utf-8") if full.exists() else ""


def build_prompt(ticket_num: str, ticket_file: str) -> str:
    agents_md = read("AGENTS.md")
    ticket_md = read(ticket_file)
    diff = Path("/tmp/pr.diff.trimmed").read_text(encoding="utf-8", errors="replace")

    is_security = ticket_num in SECURITY_TICKETS
    security_block = ""
    if is_security:
        security_block = """
### Security Review (mandatory for this ticket)

Check ALL of these. If any cannot be verified from the diff, mark ❌.

- **Auth (Ticket 03)**: bcrypt cost factor 12; JWT in HTTP-only secure cookie
  with sameSite=lax, NOT localStorage; refresh token in separate cookie;
  password length validated ≥8 chars; Google OAuth verified via google-auth-library;
  signup grants exactly 20 coins via a CoinTransaction row; rate limiting on
  login/register endpoints.
- **Unlock (Ticket 05)**: chapter unlock wraps coin balance update + ChapterUnlock
  insert + CoinTransaction insert in a single Prisma transaction; free chapters
  readable by guests (no auth required); active subscription bypasses unlock
  without spending coins; idempotent on retry (re-unlocking already-unlocked
  chapter does NOT charge again).
- **Stripe (Ticket 06)**: webhook signature verified with STRIPE_WEBHOOK_SECRET
  via stripe.webhooks.constructEvent (NOT manual HMAC); event.id stored in DB
  for idempotency check before processing; refund logic reverses coin grant
  with a negative CoinTransaction; Customer Portal endpoint exists; webhook
  endpoint NOT behind JWT guard.
- **FB CAPI (Ticket 11)**: same event_id passed end-to-end (frontend Pixel
  fbq + backend CAPI must use identical UUID for the same logical event);
  Purchase event always sent server-side as source of truth; every CAPI call
  logged to fb_events table with response code; user data hashed (email, phone)
  before sending to Facebook.
"""

    prompt = f"""You are reviewing a pull request for the NovelHub project. Be strict, specific, and cite file paths and line numbers from the diff when flagging issues. The cost of approving a buggy PR (which then gets auto-merged) is much higher than the cost of asking Codex to clarify or fix something.

# Project context

## AGENTS.md (project conventions — VIOLATIONS ARE BLOCKING)

{agents_md}

## Ticket being implemented ({ticket_file})

{ticket_md}

# Pull request diff

```diff
{diff}
```

# Your task

Output a Markdown review with EXACTLY these sections in this order. Start directly with the `## Claude Review` heading. No preamble. No closing remarks.

## Claude Review

### Acceptance Criteria

Render as a Markdown table. For EACH criterion in the ticket's "Acceptance Criteria" section, one row. If the ticket has no explicit acceptance criteria section, derive checks from its Tasks list.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| (paraphrase the criterion) | ✅ / ❌ / ⚠️ | (path/to/file.ts:LINE, or "missing", or "cannot verify from diff") |

### AGENTS.md Compliance

Check every applicable rule. List violations as a numbered list with file:line citation. If none, write exactly: "No violations found."

Specifically check:
1. `any` type used without a justifying comment.
2. localStorage / sessionStorage used for auth tokens or sensitive data.
3. Hardcoded prices, URLs, secrets, or user-facing strings (must live in `packages/shared` constants, env vars, or `messages/en.json`).
4. Components that use hooks / event handlers / state but are missing `'use client'` at top.
5. Raw SQL instead of Prisma without a justifying comment.
6. New service / controller / component code without accompanying tests.
7. New dependencies in any package.json that are NOT listed in AGENTS.md's tech stack.
8. `console.log` or other debug code left in production paths.
9. `.env` files committed (only `.env.example` should exist).
10. Public POST / PATCH / DELETE endpoints missing input validation (DTO with class-validator on backend, zod on frontend).
11. Stripe webhook or other public endpoints under JWT guard when they shouldn't be.

### Scope

Did the PR touch only files needed for this ticket? List any out-of-scope changes (e.g. unrelated refactors, modifications to other tickets' files). If clean, write exactly: "In scope."
{security_block}
### Required Fixes

If verdict is REQUEST_CHANGES, write a numbered list of EXACT fixes. Each fix must be actionable by Codex with no further clarification. Format strictly:

1. In `path/to/file.ts:LINE`, change `<old>` to `<new>` because <one-sentence reason>.

If verdict is APPROVE, write exactly: "None."

### Verdict: APPROVE | REQUEST_CHANGES | COMMENT

Choose ONE. Write the verdict on its own at the end of the line, e.g. "### Verdict: APPROVE".

Use APPROVE only when:
- Every Acceptance Criterion is ✅, AND
- No AGENTS.md violations, AND
- Scope is clean, AND
- (For security tickets) every security check passes.

When in doubt, choose REQUEST_CHANGES. Do not approve to be polite.
"""
    return prompt


def build_unavailable_review(reason: str) -> str:
    return f"""## Claude Review

### Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Automated Claude review completed | WARNING | {reason} |

### AGENTS.md Compliance

Automated review could not run because the Anthropic API was unavailable. A human should review the PR before merging.

### Scope

Cannot verify automatically while Claude review is unavailable.

### Required Fixes

None.

### Verdict: COMMENT"""


def main() -> int:
    ticket_num = os.environ.get("TICKET_NUM", "")
    ticket_file = os.environ.get("TICKET_FILE", "")
    if not ticket_num or not ticket_file:
        print("ERROR: TICKET_NUM and TICKET_FILE env vars required", file=sys.stderr)
        return 2

    prompt = build_prompt(ticket_num, ticket_file)
    try:
        client = Anthropic()
        msg = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
    except AnthropicError as exc:
        print(build_unavailable_review(f"Anthropic API error: {exc.__class__.__name__}."))
        return 0

    # Concatenate all text blocks
    parts = []
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    review = "".join(parts).strip()
    if not review:
        review = "## Claude Review\n\n(Empty response from model.)\n\n### Verdict: REQUEST_CHANGES"

    print(review)
    return 0


if __name__ == "__main__":
    sys.exit(main())
