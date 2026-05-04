# NovelHub

Mobile-first English web novel PWA for paid acquisition via Facebook Ads.

## For AI Coding Agents

Start by reading `AGENTS.md`. It contains the project standards, tech stack rules, ticket workflow, and definition of done.

Work tickets in order from `docs/tickets/`. Ticket 01 initializes this pnpm monorepo; later tickets depend on this foundation.

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 15 for database work in later tickets
- Redis 7 for cache work in later tickets

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill in `.env` with local development values. Do not commit real secrets.

## Development

```bash
pnpm --filter web dev
pnpm --filter api start:dev
```

The frontend runs on `http://localhost:3000`. The API runs on `http://localhost:4000`.

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter api test:e2e
```

## Workspace Structure

```text
apps/
  web/        Next.js frontend
  api/        NestJS backend
packages/
  shared/     Shared TypeScript types and constants
  db/         Prisma schema and database tooling
docs/
  tickets/    Development tickets 01-14
AGENTS.md     AI agent project context
```

## Database Package

The Prisma schema lives in `packages/db/prisma/schema.prisma`.

```bash
pnpm --filter db prisma:generate
pnpm --filter db prisma:migrate
pnpm --filter db prisma:studio
```

Ticket 02 adds the domain schema and migrations.

## License

Private. All rights reserved.
