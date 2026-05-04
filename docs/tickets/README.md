# Development Tickets

Work these in order. Each ticket is self-contained and has clear acceptance criteria.

## Workflow per ticket
1. Create branch: `feature/<id>-<short-slug>` (e.g. `feature/01-monorepo-setup`)
2. Read the ticket file completely
3. Read `AGENTS.md` for conventions
4. Implement, including tests
5. Run lint, typecheck, tests
6. Open PR with title `feat(<scope>): <ticket title>`, link to ticket file
7. After merge, move to next ticket

## Tickets

| # | File | Title | Estimated Time |
|---|------|-------|----------------|
| 01 | `01-monorepo-setup.md` | Initialize Monorepo and Tooling | 0.5 day |
| 02 | `02-database-schema.md` | Database Schema with Prisma | 0.5 day |
| 03 | `03-auth-module.md` | Authentication API | 1.5 days |
| 04 | `04-books-chapters-api.md` | Books and Chapters API | 1.5 days |
| 05 | `05-coin-unlock.md` | Coins and Chapter Unlock | 1 day |
| 06 | `06-stripe-payment.md` | Stripe Subscriptions and Purchases | 2 days |
| 07 | `07-frontend-home-book.md` | Frontend Home and Book Detail | 2 days |
| 08 | `08-frontend-reader-paywall.md` | Reader Page and Paywall | 2 days |
| 09 | `09-frontend-auth-account.md` | Auth Modals, Account, Recharge | 1.5 days |
| 10 | `10-checkin-progress.md` | Check-in and Reading Progress | 1 day |
| 11 | `11-fb-pixel-capi.md` | FB Pixel and Conversions API | 1.5 days |
| 12 | `12-pwa-onesignal.md` | PWA and OneSignal Push | 1.5 days |
| 13 | `13-compliance-admin.md` | Legal Pages and Admin Panel | 2 days |
| 14 | `14-deployment-qa.md` | Production Deployment and QA | 2 days |

**Total: ~20 working days for one full-stack engineer**

## Dependency Graph

```
01 ─┬─ 02 ─┬─ 03 ─┬─ 04 ─┬─ 05 ─┬─ 06 ─┐
    │     │     │     │     │     │
    │     │     │     │     │     ├── 07 ─┬─ 08 ─── 09 ─── 10 ─┐
    │     │     │     │     │     │      │                     │
    │     │     │     │     │     │      └── 11 ────────────────┤
    │     │     │     │     │     │                            │
    │     │     │     │     │     │      ┌── 12 ───────────────┤
    │     │     │     │     │     │      │                     │
    │     │     │     │     │     │      └── 13 ───────────────┤
    │     │     │     │     │     │                            │
    └─────┴─────┴─────┴─────┴─────┴──────────────────────────── 14
```
