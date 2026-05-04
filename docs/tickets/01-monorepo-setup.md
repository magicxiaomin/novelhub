# Ticket 01: Initialize Monorepo and Tooling

## Goal
Set up the project skeleton as a pnpm monorepo with two apps (web, api) and shared packages.

## Tasks
1. Initialize pnpm workspace with `pnpm-workspace.yaml`
2. Create folder structure as described in AGENTS.md
3. Set up `apps/web` as Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
4. Set up `apps/api` as NestJS + TypeScript
5. Create `packages/shared` for shared types and constants
6. Create `packages/db` for Prisma schema
7. Configure root-level ESLint, Prettier, TypeScript base configs
8. Add Husky + lint-staged for pre-commit hooks
9. Add `.env.example` with all variables from AGENTS.md
10. Add basic `README.md` with setup instructions (or update existing)

## Acceptance Criteria
- `pnpm install` works at root
- `pnpm --filter web dev` starts Next.js on :3000
- `pnpm --filter api start:dev` starts NestJS on :4000
- `pnpm lint` and `pnpm typecheck` run across all packages
- Pre-commit hook blocks commits with lint errors
- `.env.example` is complete

## Out of Scope
- Any actual feature code
- Deployment config
