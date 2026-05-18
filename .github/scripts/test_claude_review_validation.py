#!/usr/bin/env python3
"""Regression tests for Claude auto-review output validation."""
from __future__ import annotations

import importlib.util
import contextlib
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT_DIR = Path(__file__).resolve().parent


def load_script(name: str):
    path = SCRIPT_DIR / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


claude_review = load_script("claude_review")
claude_security_review = load_script("claude_security_review")


def substantive_security_review(verdict: str) -> str:
    return "\n".join(
        [
            "## Claude Security Review",
            "",
            "### Findings",
            "No security findings.",
            "",
            "### New dependencies",
            "No new dependencies.",
            "",
            "### New external hosts",
            "No new external hosts.",
            "",
            "Additional rationale: the diff only touches CI review scripts and does not add network egress, secrets, product code, or dependencies.",
            "This review is intentionally long enough to satisfy the structural minimum and avoid placeholder approvals.",
            "",
            f"### Verdict: {verdict}",
        ]
    )


class ClaudeReviewValidationTest(unittest.TestCase):
    def test_correctness_rejects_empty_output(self) -> None:
        self.assertEqual(
            claude_review.validate_review(""),
            "infra/model-empty: Claude produced no output",
        )

    def test_correctness_rejects_missing_verdict(self) -> None:
        review = "## Claude Review\n\n### Acceptance Criteria\n\n" + ("substantive body\n" * 20)
        self.assertIn("no '### Verdict", claude_review.validate_review(review) or "")

    def test_correctness_accepts_substantive_review(self) -> None:
        review = "\n".join(
            [
                "## Claude Review",
                "",
                "### Acceptance Criteria",
                "| Criterion | Status | Evidence |",
                "|-----------|--------|----------|",
                "| Tests pass | PASS | `.github/scripts/foo.py:1` |",
                "",
                "### AGENTS.md Compliance",
                "No violations found.",
                "",
                "### Scope",
                "In scope.",
                "",
                "### Required Fixes",
                "None.",
                "",
                "### Verdict: APPROVE",
            ]
        )
        self.assertIsNone(claude_review.validate_review(review))

    def test_security_rejects_short_empty_placeholder(self) -> None:
        review = "## Claude Security Review\n\n(Empty response from model.)\n\n### Verdict: REQUEST_CHANGES"
        self.assertIn("too short", claude_security_review.validate_review(review) or "")

    def test_security_accepts_substantive_review(self) -> None:
        review = "\n".join(
            [
                "## Claude Security Review",
                "",
                "### Findings",
                "No security findings.",
                "",
                "### New dependencies",
                "No new dependencies.",
                "",
                "### New external hosts",
                "No new external hosts.",
                "",
                "Additional rationale: the diff only touches CI review scripts and does not add network egress, secrets, product code, or dependencies.",
                "",
                "### Verdict: APPROVE",
            ]
        )
        self.assertIsNone(claude_security_review.validate_review(review))

    def test_security_valid_primary_review_passes_without_fallback(self) -> None:
        primary_review = substantive_security_review("APPROVE")
        with mock.patch.dict(os.environ, {"TICKET_NUM": "207", "TICKET_CONTEXT": "ticket"}, clear=False), \
            mock.patch.object(claude_security_review, "build_prompt", return_value="prompt"), \
            mock.patch.object(claude_security_review, "run_claude", return_value=(primary_review, None)), \
            mock.patch.object(claude_security_review, "run_fallback_review") as fallback:
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                exit_code = claude_security_review.main()

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.getvalue().strip(), primary_review)
        fallback.assert_not_called()

    def test_security_short_primary_uses_valid_fallback_review(self) -> None:
        fallback_review = substantive_security_review("COMMENT")
        with mock.patch.dict(os.environ, {"TICKET_NUM": "207", "TICKET_CONTEXT": "ticket"}, clear=False), \
            mock.patch.object(claude_security_review, "build_prompt", return_value="prompt"), \
            mock.patch.object(
                claude_security_review,
                "run_claude",
                return_value=("## Claude Security Review\n\nshort\n\n### Verdict: COMMENT", None),
            ), \
            mock.patch.object(claude_security_review, "run_fallback_review", return_value=(fallback_review, None)) as fallback:
            stdout = io.StringIO()
            stderr = io.StringIO()
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                exit_code = claude_security_review.main()

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.getvalue().strip(), fallback_review)
        self.assertEqual(stderr.getvalue(), "")
        fallback.assert_called_once()
        self.assertIn("output is too short", fallback.call_args.args[1])

    def test_security_short_primary_and_invalid_fallback_emits_comment_for_non_docs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            diff_path = Path(tmpdir) / "pr.diff.trimmed"
            diff_path.write_text("diff --git a/apps/api/src/auth.ts b/apps/api/src/auth.ts\n+code change\n", encoding="utf-8")
            with mock.patch.dict(
                os.environ,
                {"TICKET_NUM": "207", "TICKET_CONTEXT": "ticket", "PR_DIFF_PATH": str(diff_path)},
                clear=False,
            ), \
                mock.patch.object(claude_security_review, "build_prompt", return_value="prompt"), \
                mock.patch.object(claude_security_review, "run_claude", return_value=("", None)), \
                mock.patch.object(claude_security_review, "run_fallback_review", return_value=("still bad", None)):
                stdout = io.StringIO()
                stderr = io.StringIO()
                with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                    exit_code = claude_security_review.main()

        output = stdout.getvalue()
        self.assertEqual(exit_code, 0)
        self.assertEqual(stderr.getvalue(), "")
        self.assertIn("fallback invalid", output)
        self.assertIn("### Verdict: COMMENT", output)
        self.assertIn("auto-merge remains blocked", output)
        self.assertNotIn("### Verdict: APPROVE", output)
        self.assertIsNone(claude_security_review.validate_review(output))

    def test_security_docs_only_invalid_primary_and_fallback_gets_deterministic_approve(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            diff_path = Path(tmpdir) / "pr.diff.trimmed"
            diff_path.write_text(
                "diff --git a/docs/runbooks/drama-delete.md b/docs/runbooks/drama-delete.md\n"
                "+operator docs update\n",
                encoding="utf-8",
            )
            with mock.patch.dict(
                os.environ,
                {"TICKET_NUM": "223", "TICKET_CONTEXT": "ticket", "PR_DIFF_PATH": str(diff_path)},
                clear=False,
            ), \
                mock.patch.object(claude_security_review, "build_prompt", return_value="prompt"), \
                mock.patch.object(claude_security_review, "run_claude", return_value=("", None)), \
                mock.patch.object(claude_security_review, "run_fallback_review", return_value=("still bad", None)):
                stdout = io.StringIO()
                stderr = io.StringIO()
                with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                    exit_code = claude_security_review.main()

        output = stdout.getvalue()
        self.assertEqual(exit_code, 0)
        self.assertEqual(stderr.getvalue(), "")
        self.assertIn("### Verdict: APPROVE", output)
        self.assertIn("documentation-only", output)
        self.assertIsNone(claude_security_review.validate_review(output))

    def test_security_docs_only_policy_rejects_workflow_changes(self) -> None:
        diff = "diff --git a/.github/workflows/review.yml b/.github/workflows/review.yml\n+workflow change\n"
        self.assertFalse(claude_security_review.is_docs_only_diff(diff))

    def test_review_scripts_read_configured_diff_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            diff_path = Path(tmpdir) / "pr.diff.trimmed"
            diff_path.write_text("diff --git a/example b/example\n+configured diff path\n", encoding="utf-8")
            previous = os.environ.get("PR_DIFF_PATH")
            os.environ["PR_DIFF_PATH"] = str(diff_path)
            try:
                correctness_prompt = claude_review.build_prompt("172", "")
                security_prompt = claude_security_review.build_prompt("172", "")
            finally:
                if previous is None:
                    os.environ.pop("PR_DIFF_PATH", None)
                else:
                    os.environ["PR_DIFF_PATH"] = previous

        self.assertIn("configured diff path", correctness_prompt)
        self.assertIn("configured diff path", security_prompt)


if __name__ == "__main__":
    unittest.main()
