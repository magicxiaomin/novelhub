#!/usr/bin/env python3
"""Generate an execution plan and machine-checkable acceptance script for a ticket.

Reads:
  $TICKET_NUM   — two-digit ticket number (e.g. "03")
  $TICKET_FILE  — path to the ticket markdown (e.g. docs/tickets/03-auth-module.md)
  AGENTS.md, docs/_postmortem.md (when present)

Writes:
  /tmp/plan.md           — markdown plan, gets appended to the issue body
  /tmp/acceptance.sh     — bash script Codex must place at acceptance/NN.sh verbatim

Output the model's response in two parts separated by the literal marker
=====ACCEPTANCE_SCRIPT===== so a downstream step can split them.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
CLAUDE_TIMEOUT_SECONDS = int(os.environ.get("CLAUDE_TIMEOUT_SECONDS", "600"))
MARKER = "=====ACCEPTANCE_SCRIPT====="


def read(path: str) -> str:
    full = REPO_ROOT / path
    return full.read_text(encoding="utf-8") if full.exists() else ""


def build_prompt(ticket_num: str, ticket_file: str) -> str:
    agents_md = read("AGENTS.md")
    ticket_md = read(ticket_file)
    postmortem = read("docs/_postmortem.md") or "(no postmortem yet — this is an early ticket)"

    return f"""You are the planning agent for the NovelHub auto-pipeline. Your output becomes the spec Codex executes against. Be specific, mechanical, and unambiguous. Codex is precise but literal — vague language ("clean code", "robust") is wasted; concrete instructions ("create file X with shape Y") are used.

# Inputs

## AGENTS.md (project conventions — Codex must follow these)

{agents_md}

## Ticket {ticket_num} ({ticket_file})

{ticket_md}

## docs/_postmortem.md (lessons learned from prior tickets — APPLY THEM)

{postmortem}

# Output

Output two parts separated by exactly this marker line on its own:

{MARKER}

## Part 1 (before the marker): Plan markdown

Use exactly this structure, no preamble:

### Implementation Plan

Numbered steps. Each step says: which file to create or modify, what to add. Be specific about file paths, function names, schema shapes, route paths, response types. No prose; just instructions.

### Acceptance Criteria

Bulleted list. Each criterion must be MECHANICALLY VERIFIABLE — a bash script can check it. Examples of acceptable criteria:
- "packages/db/prisma/schema.prisma defines model User with field email @unique"
- "GET /api/health returns 200 with body containing 'ok':true"
- "pnpm --filter @novelhub/db prisma:seed exits 0 on first run AND on second run"

Examples of UNACCEPTABLE criteria (vague, not mechanical):
- "Code follows best practices"
- "Schema is well-designed"
- "Error handling is robust"

### Edge Cases & Risks

Bulleted list. For each ambiguity Codex might trip on, give the answer outright — never leave open. If you don't know, write "Defer to: <specific question>" so the user can answer before Codex starts.

### Test Matrix

Markdown table:

| Layer | Test | What it asserts |
|---|---|---|
| unit | ... | ... |
| integration | ... | ... |
| smoke | ... | ... |

### Out of Scope

Bulleted list. Things that look related but belong to other tickets.

## Part 2 (after the marker): acceptance.sh

A complete bash script. Codex must copy this to acceptance/{ticket_num}.sh verbatim — do not paraphrase. The script:

- Starts with `#!/usr/bin/env bash` and `set -euo pipefail`
- Runs from the repo root (assume CWD = root)
- Each criterion is a `echo "checking: <name>"` line followed by a test
- Exits 0 only when every criterion passes
- Uses `pnpm --filter ...` for package-scoped commands; `node -e '...'` for runtime probes; `grep`, `test`, `jq` for file/structure checks
- Does NOT call external network services. Does NOT require auth. Does NOT spin up the full app server (use ephemeral test runner only). The CI environment has Postgres available at $DATABASE_URL.
- On any failure, prints which criterion failed and exits non-zero

Output ONLY the two parts and the marker. No backticks around the bash. No commentary outside the two parts.
"""


def main() -> int:
    ticket_num = os.environ.get("TICKET_NUM", "")
    ticket_file = os.environ.get("TICKET_FILE", "")
    if not ticket_num or not ticket_file:
        print("ERROR: TICKET_NUM and TICKET_FILE env vars required", file=sys.stderr)
        return 2

    prompt = build_prompt(ticket_num, ticket_file)
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
        print(f"ERROR: `{CLAUDE_BIN}` binary not on PATH on the runner host.", file=sys.stderr)
        return 3
    except subprocess.TimeoutExpired:
        print(f"ERROR: `claude -p` timed out after {CLAUDE_TIMEOUT_SECONDS}s.", file=sys.stderr)
        return 3
    except OSError as exc:
        print(f"ERROR: `claude -p` could not be launched: {exc}", file=sys.stderr)
        return 3

    if result.returncode != 0:
        stderr_tail = (result.stderr or "").strip()[-500:]
        print(
            f"ERROR: `claude -p` exited {result.returncode}: {stderr_tail or 'no stderr'}",
            file=sys.stderr,
        )
        return 3

    response = result.stdout.strip()

    if MARKER not in response:
        print("ERROR: model output missing marker", file=sys.stderr)
        print(response, file=sys.stderr)
        return 4

    plan_md, _, acceptance_raw = response.partition(MARKER)

    acceptance = acceptance_raw.strip()
    acceptance = re.sub(r"^```(?:bash|sh)?\s*\n", "", acceptance)
    acceptance = re.sub(r"\n```\s*$", "", acceptance)
    if not acceptance.startswith("#!"):
        acceptance = "#!/usr/bin/env bash\nset -euo pipefail\n\n" + acceptance

    Path("/tmp/plan.md").write_text(plan_md.strip() + "\n", encoding="utf-8")
    Path("/tmp/acceptance.sh").write_text(acceptance.strip() + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
