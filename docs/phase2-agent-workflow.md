# NovelHub Phase 2 Agent Workflow

This repository uses a controlled multi-agent workflow for Phase 2 work.

## Roles / Hermes profiles

- `novelhub-orchestrator`: owns GitHub Issue <-> Hermes Kanban <-> PR traceability. Routes work; does not implement.
- `novelhub-claude-requirements`: clarifies raw requirements and writes Proposal v1.
- `novelhub-codex-feasibility`: reviews Proposal v1 against the real repo and challenges feasibility.
- `novelhub-claude-architect`: makes final product/architecture decisions after Codex review.
- `novelhub-codex-dev`: implements approved tasks in isolated git worktrees.
- `novelhub-claude-reviewer`: reviews PRs for spec compliance and code quality.

## CCR requirement workflow

1. Human provides raw requirement.
2. Claude requirements owner outputs:
   - restated requirement
   - clarifying questions / assumptions
   - scope and non-goals
   - user stories
   - acceptance criteria
   - Proposal v1
3. Codex feasibility reviewer reads the real repo and outputs APPROVE / REVISE / BLOCK.
4. Claude architect resolves every Codex finding as Adopted / Rejected / Modified, then writes Final Spec.
5. Human approves before implementation.

## Delivery workflow

Issue -> Kanban task graph -> worktree branch -> Codex implementation -> PR -> Claude review -> CI -> human merge -> Issue closed -> Kanban done.

## Required gates

- Requirement Gate: Final Spec approved by human.
- Implementation Gate: branch, tests, local checks, PR opened.
- Review Gate: Claude spec review and code review pass.
- Merge Gate: CI green, linked Issue, complete PR body, human approval.

## Worktree convention

Main checkout: `/root/novelhub`

Worktrees: `/root/novelhub-worktrees/<issue-or-task-slug>`

Branch naming:

- `feature/<issue-or-ticket>-<slug>`
- `fix/<issue-or-ticket>-<slug>`
- `test/<issue-or-ticket>-<slug>`
- `ci/<issue-or-ticket>-<slug>`

Do not run multiple implementation agents in the same worktree. Changes to schema, shared types, dependencies, routing, or build config should be serialized.

## Kanban implementation task template

```text
Linked Issue:
Goal:
Non-goals:
Acceptance Criteria:
Target branch:
Workspace: worktree under /root/novelhub-worktrees/<slug>
Expected files:
Forbidden files:
Commands to run:
Definition of Done:
Linked PR:
```
