#!/usr/bin/env python3
"""Run a Claude review against a PR diff and emit Markdown to stdout.

Reads:
  $TICKET_FILE - path to ticket markdown, e.g. docs/tickets/02-database-schema.md
  $TICKET_NUM - two-digit ticket number, e.g. "02"
  /tmp/pr.diff.trimmed - unified diff to review, capped upstream
  AGENTS.md and the ticket file relative to the repo root

Writes:
  Markdown review to stdout. The final verdict heading must be exactly one of
  APPROVE, REQUEST_CHANGES, or COMMENT.

Exit codes:
  0 - a review (or an "unavailable" COMMENT notice) was written to stdout.
  2 - missing required environment variables.
  3 - the model/CLI produced empty or structurally-invalid output. This is an
      infrastructure failure (infra/model-empty), NOT a reason to post a
      REQUEST_CHANGES verdict; the workflow must fail rather than post anything.

Auth: invokes the `claude` CLI in non-interactive mode (`claude -p`) using the
credentials from the runner user's `~/.claude/.credentials.json`. This routes
through the user's Claude Max subscription instead of consuming Anthropic API
credits — see .github/workflows/README.md.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SECURITY_TICKETS = {"03", "05", "06", "11"}
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
CLAUDE_TIMEOUT_SECONDS = int(os.environ.get("CLAUDE_TIMEOUT_SECONDS", "300"))

# A usable review must contain this heading, an explicit verdict line, and at
# least this many characters of body. Anything less means the model/CLI
# misbehaved (empty or truncated output) and we must fail loudly instead of
# emitting a bogus REQUEST_CHANGES verdict.
REVIEW_HEADING = "## Claude Review"
VERDICT_LINE_RE = re.compile(r"(?im)^###\s*Verdict:?\s*(APPROVE|REQUEST_CHANGES|COMMENT)\b")
MIN_REVIEW_CHARS = 200


def read(path: str) -> str:
    full = REPO_ROOT / path
    return full.read_text(encoding="utf-8") if full.exists() else ""


def ticket_context(ticket_file: str) -> str:
    if ticket_file and (REPO_ROOT / ticket_file).exists():
        return read(ticket_file)
    env_context = os.environ.get("TICKET_CONTEXT", "").strip()
    if env_context:
        return env_context
    return "(No ticket file/context was available; judge against the PR description and diff.)"


def build_prompt(ticket_num: str, ticket_file: str) -> str:
    agents_md = read("AGENTS.md")
    ticket_md = ticket_context(ticket_file)
    postmortem = read("docs/_postmortem.md")
    diff = Path("/tmp/pr.diff.trimmed").read_text(encoding="utf-8", errors="replace")

    is_security = ticket_num in SECURITY_TICKETS
    security_block = ""
    if is_security:
        security_block = """
### Security Review (mandatory for this ticket)

Check ALL of these. If any cannot be verified from the diff, mark FAIL.

- **Auth (Ticket 03)**: bcrypt cost factor 12; JWT in HTTP-only secure cookie
  with sameSite=lax, NOT localStorage; refresh token in separate cookie;
  password length validated >=8 chars; Google OAuth verified via google-auth-library;
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

    prompt = f"""You are reviewing a pull request for the NovelHub project. Be strict, specific, and cite file paths and line numbers from the diff when flagging issues. The cost of approving a buggy PR, which may then get auto-merged, is much higher than the cost of asking Codex to clarify or fix something.

# Project context

## AGENTS.md (project conventions - violations are blocking)

{agents_md}

## Ticket being implemented ({ticket_file})

{ticket_md}

## docs/_postmortem.md (lessons from prior tickets — apply when judging this PR)

{postmortem if postmortem else "(no postmortem yet — this is an early ticket)"}

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
| (paraphrase the criterion) | PASS / FAIL / WARN | (path/to/file.ts:LINE, or "missing", or "cannot verify from diff") |

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
11. Stripe webhook or other public endpoints under JWT guard when they should not be.

### Scope

Did the PR touch only files needed for this ticket? List any out-of-scope changes. If clean, write exactly: "In scope."
{security_block}
### Required Fixes

If verdict is REQUEST_CHANGES, write a numbered list of EXACT fixes. Each fix must be actionable by Codex with no further clarification. Format strictly:

1. In `path/to/file.ts:LINE`, change `<old>` to `<new>` because <one-sentence reason>.

If verdict is APPROVE, write exactly: "None."

### Verdict: APPROVE | REQUEST_CHANGES | COMMENT

Choose ONE. Write the verdict on its own at the end of the line, e.g. "### Verdict: APPROVE".

Use APPROVE only when:
- Every Acceptance Criterion is PASS, AND
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
| Automated Claude review completed | WARN | {reason} |

### AGENTS.md Compliance

Automated review could not run. A human should review the PR before merging.

### Scope

Cannot verify automatically while Claude review is unavailable.

### Required Fixes

None.

### Verdict: COMMENT"""


def validate_review(review: str) -> str | None:
    """Return an error string if `review` is not a usable model review, else None.

    Empty or structurally-broken output means the model/CLI misbehaved, which is
    an infrastructure problem — callers must surface it as a failure rather than
    posting it as a REQUEST_CHANGES verdict.
    """
    text = (review or "").strip()
    if not text:
        return "infra/model-empty: Claude produced no output"
    if REVIEW_HEADING not in text:
        return f"infra/model-malformed: output is missing the required '{REVIEW_HEADING}' heading"
    if not VERDICT_LINE_RE.search(text):
        return "infra/model-malformed: output has no '### Verdict: APPROVE|REQUEST_CHANGES|COMMENT' line"
    if len(text) < MIN_REVIEW_CHARS:
        return f"infra/model-empty: output is too short to be a real review ({len(text)} chars)"
    return None


def run_fallback_review(prompt: str, claude_error: str) -> tuple[str, str | None]:
    """Fallback to the local Hermes/Codex reviewer when Claude CLI auth is unavailable."""
    fallback = os.environ.get("REVIEW_FALLBACK_CMD", "/opt/hermes-runner/hermes-agent/runner-venv/bin/hermes")
    if not fallback:
        return ("", claude_error)
    if not Path(fallback).exists() and fallback == "/opt/hermes-runner/hermes-agent/runner-venv/bin/hermes":
        fallback = "hermes"

    fallback_prompt = (
        prompt
        + "\n\n# Fallback execution note\n"
        + "Claude CLI failed with: "
        + claude_error
        + "\nYou are running as the configured fallback reviewer. Preserve the required output format exactly. "
        + "Do not edit files; only review the diff.\n"
    )
    env = os.environ.copy()
    env.setdefault("HERMES_PROFILE", "novelhub-codex-feasibility")
    cmd = [fallback, "-z", fallback_prompt, "-t", "terminal,file", "--skills", "codex,github-pr-workflow", "--yolo"]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=CLAUDE_TIMEOUT_SECONDS,
            check=False,
            env=env,
        )
    except FileNotFoundError:
        return ("", claude_error + f"; fallback `{fallback}` binary not on PATH.")
    except subprocess.TimeoutExpired:
        return ("", claude_error + f"; fallback `{fallback}` timed out after {CLAUDE_TIMEOUT_SECONDS}s.")
    except OSError as exc:
        return ("", claude_error + f"; fallback `{fallback}` could not be launched: {exc}")

    if result.returncode != 0:
        stderr_tail = (result.stderr or "").strip()[-500:]
        return ("", claude_error + f"; fallback `{fallback}` exited {result.returncode}: {stderr_tail or 'no stderr'}")

    return (result.stdout.strip(), None)


def run_claude(prompt: str) -> tuple[str, str | None]:
    """Invoke `claude -p`; if unavailable, fallback to Hermes/Codex review."""
    try:
        result = subprocess.run(
            [CLAUDE_BIN, "-p", "--output-format", "text"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=CLAUDE_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError:
        return run_fallback_review(prompt, f"`{CLAUDE_BIN}` binary not on PATH on the runner host.")
    except subprocess.TimeoutExpired:
        return run_fallback_review(prompt, f"`claude -p` timed out after {CLAUDE_TIMEOUT_SECONDS}s.")
    except OSError as exc:
        return run_fallback_review(prompt, f"`claude -p` could not be launched: {exc}")

    if result.returncode != 0:
        stderr_tail = (result.stderr or "").strip()[-500:]
        return run_fallback_review(prompt, f"`claude -p` exited {result.returncode}: {stderr_tail or 'no stderr'}")

    return (result.stdout.strip(), None)


def main() -> int:
    ticket_num = os.environ.get("TICKET_NUM", "")
    ticket_file = os.environ.get("TICKET_FILE", "")
    if not ticket_num:
        print("ERROR: TICKET_NUM env var required", file=sys.stderr)
        return 2
    if not ticket_file and not os.environ.get("TICKET_CONTEXT", "").strip():
        print("ERROR: TICKET_FILE or TICKET_CONTEXT env var required", file=sys.stderr)
        return 2

    prompt = build_prompt(ticket_num, ticket_file)
    review, error = run_claude(prompt)
    if error:
        # Reviewer (and Hermes fallback) unavailable: degrade to a COMMENT-verdict
        # notice instead of blocking the PR. Deliberately distinct from the model
        # returning empty/garbage, which is handled just below.
        print(build_unavailable_review(error))
        return 0

    problem = validate_review(review)
    if problem:
        print(f"ERROR: {problem}", file=sys.stderr)
        return 3

    print(review)
    return 0


if __name__ == "__main__":
    sys.exit(main())
