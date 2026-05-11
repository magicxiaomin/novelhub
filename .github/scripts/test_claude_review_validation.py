#!/usr/bin/env python3
"""Regression tests for Claude auto-review output validation."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
