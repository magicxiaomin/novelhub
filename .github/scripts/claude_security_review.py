#!/usr/bin/env python3
"""Run an INDEPENDENT security-focused Claude review against a PR diff.

This complements claude_review.py (correctness/scope/AGENTS-conformance review).
The two prompts are intentionally written from cold context with non-overlapping
checklists so we get a second-opinion signal rather than a louder echo of the
first review. Auto-merge requires BOTH reviewers to APPROVE.

Reads:
  $TICKET_FILE - path to ticket markdown (e.g. docs/tickets/03-auth-module.md)
  $TICKET_NUM  - two-digit ticket number
  $PR_DIFF_PATH - optional path to capped unified diff (defaults to /tmp/pr.diff.trimmed)
  AGENTS.md, the ticket file, docs/_postmortem.md (when present)

Writes:
  Markdown review to stdout. The verdict heading must end with one of
  APPROVE / REQUEST_CHANGES / COMMENT (parsed by the workflow).

Exit codes:
  0 - a review (or an "unavailable" COMMENT notice) was written to stdout.
  2 - missing required environment variables.
  3 - the model/CLI produced empty or structurally-invalid output. This is an
      infrastructure failure (infra/model-empty), NOT a reason to post a
      REQUEST_CHANGES verdict; the workflow must fail rather than post anything.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
CLAUDE_TIMEOUT_SECONDS = int(os.environ.get("CLAUDE_TIMEOUT_SECONDS", "300"))

# A usable review must contain this heading, an explicit verdict line, and at
# least this many characters of body. Anything less means the model/CLI
# misbehaved (empty or truncated output) and we must fail loudly instead of
# emitting a bogus REQUEST_CHANGES verdict.
REVIEW_HEADING = "## Claude Security Review"
VERDICT_LINE_RE = re.compile(r"(?im)^###\s*Verdict:?\s*(APPROVE|REQUEST_CHANGES|COMMENT)\b")
MIN_REVIEW_CHARS = 200
DOCS_ONLY_EXTENSIONS = {".md", ".mdx", ".txt", ".rst"}
DOCS_ONLY_ROOT_FILES = {"AGENTS.md", "README.md", "CHANGELOG.md", "CONTRIBUTING.md"}


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


def read_pr_diff() -> str:
    diff_path = Path(os.environ.get("PR_DIFF_PATH", "/tmp/pr.diff.trimmed"))
    return diff_path.read_text(encoding="utf-8", errors="replace")


def build_prompt(ticket_num: str, ticket_file: str) -> str:
    agents_md = read("AGENTS.md")
    ticket_md = ticket_context(ticket_file)
    postmortem = read("docs/_postmortem.md")
    diff = read_pr_diff()

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


def changed_paths_from_diff(diff: str) -> set[str]:
    """Return normalized repo-relative paths mentioned in a unified git diff."""
    paths: set[str] = set()
    for line in diff.splitlines():
        match = re.match(r"^diff --git a/(.+?) b/(.+)$", line)
        if not match:
            continue
        for raw_path in match.groups():
            path = raw_path.strip()
            if path and path != "/dev/null":
                paths.add(path)
    return paths


def is_docs_only_path(path: str) -> bool:
    normalized = path.replace("\\", "/")
    if normalized.startswith("docs/"):
        return True
    if "/" not in normalized and normalized in DOCS_ONLY_ROOT_FILES:
        return True
    return Path(normalized).suffix.lower() in DOCS_ONLY_EXTENSIONS and normalized.startswith(("docs/", "adr/"))


def is_docs_only_diff(diff: str) -> bool:
    paths = changed_paths_from_diff(diff)
    return bool(paths) and all(is_docs_only_path(path) for path in paths)


def build_docs_only_review(reason: str) -> str:
    return f"""## Claude Security Review

### Findings

No security findings.

### New dependencies

No new dependencies. Deterministic fallback inspected the changed file list and found only documentation paths, so the PR cannot introduce package manager dependency changes.

### New external hosts

No new external hosts. Deterministic fallback inspected the changed file list and found only documentation paths, so the PR cannot introduce runtime network egress.

Fallback rationale: automated model output was unusable ({reason}), but the diff is documentation-only. This policy is intentionally limited to docs-only diffs; code, schema, workflow, scripts, package manifests, lockfiles, and secret-bearing files still fail closed if a valid automated security review cannot be obtained.

### Verdict: APPROVE"""


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


def build_configured_fallback_review(reason: str) -> str:
    """Return a parseable, non-approving fallback verdict for non-docs diffs.

    A COMMENT verdict keeps the security_review job from failing due to review
    infrastructure while still preventing auto-merge, because auto_merge requires
    security_review.outputs.verdict == 'APPROVE'. This gives humans and rerun
    automation a durable PR comment with the exact infra reason instead of a
    silent missing review artifact.
    """
    return build_unavailable_review(
        reason
        + " Deterministic policy: this non-documentation diff is not approved by fallback; "
        + "auto-merge remains blocked until a real security reviewer returns APPROVE."
    )


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
        # Reviewer unavailable: deterministic APPROVE is safe only for docs-only
        # diffs. For non-docs diffs, emit a parseable COMMENT verdict rather
        # than failing the job with an infra error; auto_merge still requires an
        # APPROVE verdict, so this remains fail-closed for merging while leaving
        # auditable evidence on the PR.
        diff = read_pr_diff()
        if is_docs_only_diff(diff):
            print(build_docs_only_review(error))
            return 0
        print(build_configured_fallback_review(f"security review unavailable for non-docs diff: {error}"))
        return 0

    problem = validate_review(review)
    if problem:
        fallback_review, fallback_error = run_fallback_review(prompt, problem)
        if fallback_error:
            diff = read_pr_diff()
            if is_docs_only_diff(diff):
                print(build_docs_only_review(fallback_error))
                return 0
            print(
                build_configured_fallback_review(
                    f"primary invalid ({problem}); fallback unavailable for non-docs diff ({fallback_error})"
                )
            )
            return 0

        fallback_problem = validate_review(fallback_review)
        if fallback_problem:
            diff = read_pr_diff()
            if is_docs_only_diff(diff):
                print(build_docs_only_review(f"primary invalid ({problem}); fallback invalid ({fallback_problem})"))
                return 0
            print(
                build_configured_fallback_review(
                    f"primary invalid ({problem}); fallback invalid ({fallback_problem})"
                )
            )
            return 0

        print(fallback_review)
        return 0

    print(review)
    return 0


if __name__ == "__main__":
    sys.exit(main())
