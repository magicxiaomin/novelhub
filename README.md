# NovelHub

Mobile-first English web novel PWA for paid acquisition via Facebook Ads.

## For AI Coding Agents (Codex / Claude Code / Cursor)

**START HERE**: Read `AGENTS.md` first. It contains all project conventions, tech stack rules, and standards you must follow.

Then work tickets in order from `docs/tickets/`:

| # | Ticket | Depends On |
|---|--------|------------|
| 01 | Monorepo Setup | — |
| 02 | Database Schema & Prisma | 01 |
| 03 | Auth Module | 02 |
| 04 | Books & Chapters API | 02, 03 |
| 05 | Coin & Unlock System | 02, 03, 04 |
| 06 | Stripe Payment Integration | 02, 03, 05 |
| 07 | Frontend - Home & Book Detail | 04 |
| 08 | Frontend - Reader & Paywall | 04, 05, 06, 07 |
| 09 | Frontend - Auth, Account, Recharge | 03, 06, 08 |
| 10 | Daily Check-in & Reading Progress | 05, 08 |
| 11 | FB Pixel + CAPI | 03, 06, 09 |
| 12 | PWA & OneSignal Push | 07, 08, 09 |
| 13 | Compliance Pages & Admin Panel | 04, 06, 12 |
| 14 | Deployment & Pre-launch QA | all prior |

## Quick Start

```bash
pnpm install
cp .env.example .env  # fill in values
pnpm --filter db prisma:migrate dev
pnpm --filter db prisma:seed
pnpm dev               # runs both web (3000) and api (4000)
```

## Project Structure

```
/
├── apps/
│   ├── web/        Next.js frontend
│   └── api/        NestJS backend
├── packages/
│   ├── shared/     Shared types and constants
│   └── db/         Prisma schema and migrations
├── docs/
│   ├── tickets/    Development tickets 01–14
│   └── prd.md      Product requirements (MVP v1.0)
└── AGENTS.md       AI agent project context
```

## Goals

- **MVP scope**: 4–6 weeks to launch
- **First milestone**: Validate "FB ad → register → first purchase" funnel with $500–1000 test spend
- **Target metrics**:
  - Landing → register: ≥30%
  - Register → first purchase: ≥5%
  - First purchase ARPU: ≥$15
  - D7 ROAS: ≥0.8

## License

Private. All rights reserved.
