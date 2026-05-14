# NovelHub

Mobile-first English web novel PWA for paid acquisition via Facebook Ads. All 14 implementation tickets have shipped; the codebase is feature-complete pending operational launch.

## For AI Coding Agents

Start by reading `AGENTS.md` for the project standards, tech stack rules, and definition of done. The original ticket plan lives in `docs/tickets/`; the production runbook is `docs/runbook.md`.

Pivot references:

- `docs/adr/0001-novels-only-pivot.md` records the novels-only product direction, consequences, rollback path, and hard stops.
- `docs/pivot/funnel.md` maps the active ad landing -> detail -> free chapters -> paywall -> purchase/unlock -> library funnel.
- `docs/pivot/quarantine-register.md` tracks short-drama artifacts to retain, hide, gate, or propose for later cleanup.

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 15
- Redis 7 (optional locally — code short-circuits gracefully when `REDIS_URL` is unset)

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill in `.env` with local development values. The default file leaves Stripe / Resend / OneSignal / Facebook / R2 / Sentry empty — every integration short-circuits gracefully when the corresponding key is missing, so the app boots end-to-end with just `DATABASE_URL` + `REDIS_URL` + `JWT_SECRET`.

Sync the schema and seed:

```bash
pnpm --filter @novelhub/db exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter @novelhub/db prisma:seed
```

The seed creates an admin user (`admin@novelhub.local` / `admin12345`) plus three books with 10 chapters each.

## Development

```bash
pnpm dev
```

This runs both apps in parallel. Web on `http://localhost:3000`, API on `http://localhost:4000` (API docs at `/docs`). To bind to all interfaces for external testing, run web with `pnpm --filter @novelhub/web exec next dev -H 0.0.0.0 -p 3000`.

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test                                    # all packages
pnpm --filter @novelhub/api test             # api only
pnpm --filter @novelhub/web build            # next standalone build
```

`scripts/smoke.sh` walks the canonical user-flow endpoints against a running API:

```bash
API=http://localhost:4000 ./scripts/smoke.sh
```

## Workspace Structure

```text
apps/
  web/                Next.js 14 PWA (App Router, Tailwind, shadcn/ui)
  api/                NestJS 10 backend
packages/
  shared/             Shared types, constants, messages/en.json
  db/                 Prisma schema, migrations, seed
docs/
  runbook.md          Production launch + ops (Vercel/Railway/Supabase)
  architecture.md     System diagram + boundaries
  admin-guide.md      Admin panel walkthrough
  tickets/            Original 14-ticket plan (reference)
AGENTS.md             AI agent project standards
```

## Production deploy

`docs/runbook.md` is the canonical deployment guide. Migrations run as a separate one-shot pre-deploy step (Railway Pre-Deploy Command, or equivalent), **not** in the API container's ENTRYPOINT — see the runbook for the wiring.

## License

Private. All rights reserved.
