#!/usr/bin/env python3
"""Run an INDEPENDENT security-focused Claude review against a PR diff.

This complements claude_review.py (correctness/scope/AGENTS-conformance review).
The two prompts are intentionally written from cold context with non-overlapping
checklists so we get a second-opinion signal rather than a louder echo of the
first review. Auto-merge requires BOTH reviewers to APPROVE.

Reads:
  $TICKET_FILE - path to ticket markdown (e.g. docs/tickets/03-auth-module.md)
  $TICKET_NUM  - two-digit ticket number
  /tmp/pr.diff.trimmed - unified diff (capped at ~200KB upstream)
  AGENTS.md, the ticket file, docs/_postmortem.md (when present)

Writes:
  Markdown review to stdout. The verdict heading must end with one of
  APPROVE / REQUEST_CHANGES / COMMENT (parsed by the workflow).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
CLAUDE_TIMEOUT_SECONDS = int(os.environ.get("CLAUDE_TIMEOUT_SECONDS", "300"))


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

    return f"""You are an INDEPENDENT security reviewer for the NovelHub project. A separate correctness reviewer is examining functional correctness; your job is exclusively security and operational risk. Do not duplicate their checks. Be paranoid but specific - cite file paths and line numbers from the diff for every finding.

# Project context

## AGENTS.md

{agents_md}

## Ticket {ticket_num} ({ticket_file})

{ticket_md}

## docs/_postmortem.md (prior incidents — apply lessons)

{postmortem if postmortem else "(none yet)"}

# Pull request diff

```diff
{diff}
```

# Your checklist (security and operational risk only)

Treat each item as PASS / FAIL / N/A. FAIL = stop the merge.

## 1. Secrets and credentials

- Hardcoded API keys, tokens, private keys, passwords, or OAuth client secrets in source. The only acceptable place for secrets is environment variables documented in `.env.example`.
- Real `.env` files (not `.env.example`) committed.
- Secrets that look generated/test (e.g. `sk_test_...`) but might still leak — call them out even if not real production keys.

## 2. Authentication and authorization

- Public endpoints (no auth guard) that should be authenticated.
- Authenticated endpoints whose authorization checks the wrong subject (e.g. uses `req.user.id` but accepts a `userId` param without verifying ownership).
- Webhooks (Stripe, FB, etc.) protected behind a JWT guard when they MUST be public-but-signature-verified.
- Webhooks NOT verifying provider signatures (Stripe MUST use `stripe.webhooks.constructEvent`; never manual HMAC).
- JWT in localStorage / sessionStorage instead of HTTP-only secure cookie.
- Bcrypt cost factor < 12.
- Password validation < 8 chars or missing entirely.

## 3. Injection and input handling

- Raw SQL with string concatenation (must use Prisma parameterized queries; raw SQL needs justifying comment AND clear parameterization).
- Command/shell execution from user input.
- Path operations (read/write/delete) using user-controlled paths without normalization or basedir checks.
- Unescaped user input rendered in HTML / inserted into URLs without encoding.
- Regex compiled from user input (ReDoS).

## 4. Database / migrations

- Destructive Prisma migrations: `DROP COLUMN`, `DROP TABLE`, type changes that lose data, narrowing constraints on populated columns. These must be split (add new -> backfill -> remove old).
- New `@unique` or `NOT NULL` on existing populated columns without backfill.
- Foreign key direction or `onDelete` behavior change without explicit comment in the PR body.

## 5. Dependencies and supply chain

- New entries in any `package.json` `dependencies` or `devDependencies`. List them. The PR body MUST justify each new dep against AGENTS.md tech stack. If unjustified, FAIL.
- Pin / version-range changes that loosen specificity (`^` -> `*` etc.).

## 6. Network egress / external calls

- New `fetch` / `axios` / `http` calls to hosts not previously used in the codebase. List the new hosts. If a host is not documented as a project dependency (Stripe API, Facebook API, OneSignal, Google OAuth, OpenAI), FAIL.
- Calls that bypass HTTPS.
- Token-bearing requests where the token is not also pinned with `Authorization: Bearer` from a server-side env var.

## 7. Idempotency and concurrency

- Money-moving operations (coin unlock, Stripe webhook, refund) without idempotency keys or DB-level uniqueness on the operation event id.
- Multi-step DB writes that should be in a single Prisma transaction but are not.

## 8. Logging and exposure

- `console.log` / `print` of full request bodies, JWTs, password hashes, Stripe events, or PII. List file:line.
- Error messages that leak stack traces or DB structure to clients (`5xx with stacktrace body`).

## 9. Filesystem writes

- Code that writes outside conventional locations (e.g. `/tmp`, project `dist/`, `node_modules/.cache/`) — especially writes under user-controlled relative paths.

# Output format

Output a markdown document with EXACTLY these sections, no preamble:

## Claude Security Review

### Findings

Numbered list. For each finding:

`N. [SEVERITY] file:line — short headline. Why it is a problem. What to change.`

Severity is one of CRITICAL, HIGH, MEDIUM, LOW. CRITICAL or HIGH = block the merge.

If there are zero findings, write exactly: "No security findings."

### New dependencies

List every new dep introduced by this diff with version. If none, write exactly: "No new dependencies."

### New external hosts

List every new external hostname referenced by `fetch`/`axios`/etc. If none, write exactly: "No new external hosts."

### Verdict: APPROVE | REQUEST_CHANGES | COMMENT

Choose ONE on its own line at the end, e.g. `### Verdict: APPROVE`.

Use APPROVE only when:
- No findings at CRITICAL or HIGH severity, AND
- Every new dependency is justified in the PR body against AGENTS.md, AND
- Every new external host is documented project dependency.

When in doubt, choose REQUEST_CHANGES. Do not approve to be polite.
"""


def build_unavailable_review(reason: str) -> str:
    return f"""## Claude Security Review

### Findings

| Severity | Note |
|---|---|
| WARNING | Automated security review could not run: {reason} |

### New dependencies

Cannot verify automatically while Claude is unavailable.

### New external hosts

Cannot verify automatically while Claude is unavailable.

### Verdict: COMMENT"""


def run_fallback_review(prompt: str, claude_error: str) -> tuple[str, str | None]:
    """Fallback to the local Hermes/Codex reviewer when Claude CLI auth is unavailable."""
    fallback = os.environ.get("REVIEW_FALLBACK_CMD", "hermes")
    if not fallback:
        return ("", claude_error)

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
        print(build_unavailable_review(error))
        return 0

    if not review:
        review = "## Claude Security Review\n\n(Empty response from model.)\n\n### Verdict: REQUEST_CHANGES"

    print(review)
    return 0


if __name__ == "__main__":
    sys.exit(main())
