#!/usr/bin/env python3
"""Distill a postmerge lesson and prepend it to docs/_postmortem.md.

Reads:
  $TICKET_NUM   — two-digit ticket number (e.g. "02")
  $TICKET_FILE  — path to the ticket markdown
  $PR_NUMBER    — merged PR number, for citation
  $PR_TITLE     — merged PR title
  $PR_BODY      — merged PR description (testing logs etc)
  /tmp/pr.diff.trimmed — unified diff (≤200KB)
  /tmp/pr.commits.txt — commit subjects on the merged branch
  AGENTS.md, the ticket file, prior docs/_postmortem.md

Writes:
  /tmp/postmortem-entry.md — the new entry, suitable for prepending after the
  static intro section of docs/_postmortem.md.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from anthropic import Anthropic, AnthropicError

REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-7")
MAX_TOKENS = int(os.environ.get("CLAUDE_MAX_TOKENS", "1500"))


def read(path: str) -> str:
    full = REPO_ROOT / path
    return full.read_text(encoding="utf-8") if full.exists() else ""


def read_tmp(path: str) -> str:
    p = Path(path)
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


def build_prompt(ticket_num: str, ticket_file: str, pr_number: str, pr_title: str, pr_body: str) -> str:
    agents_md = read("AGENTS.md")
    ticket_md = read(ticket_file)
    prior_postmortem = read("docs/_postmortem.md")
    diff = read_tmp("/tmp/pr.diff.trimmed")
    commits = read_tmp("/tmp/pr.commits.txt")

    return f"""You are the postmerge memory keeper for the NovelHub auto-pipeline. A `feature/{ticket_num}-*` PR has just merged to `main`. Distill the lesson — what worked, what almost broke, and what rule should govern future tickets — into a tight ≤200-word entry that the planner and reviewer will read for every subsequent ticket.

Be specific. "Be careful with X" is useless. "When adding a Prisma model with a unique constraint on a soft-deleted column, also add a partial index excluding deleted rows — otherwise reactivating a deleted user collides" is useful.

# Inputs

## AGENTS.md (project conventions)

{agents_md}

## Ticket {ticket_num} ({ticket_file})

{ticket_md}

## Prior postmortem entries (do NOT repeat lessons already captured)

{prior_postmortem if prior_postmortem else "(none yet)"}

## PR #{pr_number}: {pr_title}

### Description (Codex's own writeup)

{pr_body}

### Commit subjects on the branch

{commits}

### Unified diff (truncated to 200KB)

```diff
{diff}
```

# Output

Output a single markdown section — nothing else, no preamble — formatted EXACTLY like:

## Ticket {ticket_num} — <one-line ticket title>

**What worked:** <one or two sentences naming concrete patterns or files that were correct and should be reused.>

**Pitfalls hit:**

- **<short headline>.** <Concrete description with file paths or symbols. Why it almost broke. How it was fixed in the diff. NOT vague.>
- (zero or more additional bullets, only if there were real pitfalls visible in the diff or PR body)

**Rule for future tickets:** <one or two sentences naming a concrete invariant the planner and reviewer should apply going forward. Reference paths/conventions where possible.>

If the PR was clean and there is genuinely nothing worth remembering (rare), output:

## Ticket {ticket_num} — <title>

**What worked:** <pattern>.

**Pitfalls hit:** None significant.

**Rule for future tickets:** Continue the pattern from <reference>.

Total length must be under 200 words. No code blocks. No tables. Plain prose with the bold headers above. Do not write entries about other tickets — only Ticket {ticket_num}.
"""


def build_fallback(ticket_num: str, pr_title: str, reason: str) -> str:
    return f"""## Ticket {ticket_num} — {pr_title}

**What worked:** PR merged successfully via the auto-pipeline.

**Pitfalls hit:** Postmerge analysis could not run — {reason}. A human should review the merged diff and append a manual lesson if anything is worth remembering.

**Rule for future tickets:** None recorded for this ticket.
"""


def main() -> int:
    ticket_num = os.environ.get("TICKET_NUM", "")
    ticket_file = os.environ.get("TICKET_FILE", "")
    pr_number = os.environ.get("PR_NUMBER", "")
    pr_title = os.environ.get("PR_TITLE", f"Ticket {ticket_num}")
    pr_body = os.environ.get("PR_BODY", "")

    if not ticket_num or not ticket_file or not pr_number:
        print("ERROR: TICKET_NUM, TICKET_FILE, PR_NUMBER required", file=sys.stderr)
        return 2

    try:
        client = Anthropic()
        msg = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[
                {"role": "user", "content": build_prompt(ticket_num, ticket_file, pr_number, pr_title, pr_body)}
            ],
        )
    except AnthropicError as exc:
        entry = build_fallback(ticket_num, pr_title, f"Anthropic API error: {exc.__class__.__name__}")
        Path("/tmp/postmortem-entry.md").write_text(entry, encoding="utf-8")
        return 0

    parts = []
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    entry = "".join(parts).strip()

    if not entry.startswith("## Ticket "):
        entry = build_fallback(ticket_num, pr_title, "model output did not match expected format")

    Path("/tmp/postmortem-entry.md").write_text(entry + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
