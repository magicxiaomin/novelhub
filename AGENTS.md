# NovelHub - Project Context for AI Agents

## Project Overview
NovelHub is a mobile-first English web novel PWA, designed for paid acquisition via Facebook Ads. Users land from FB ads, read 1–3 free chapters, then unlock more via subscription or coin purchases.

## Tech Stack (DO NOT CHANGE)
- **Frontend**: Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **State**: Zustand for client state, React Query (TanStack Query) for server state
- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL 15 (via Prisma ORM)
- **Cache**: Redis 7
- **Storage**: Cloudflare R2 (S3-compatible) for chapter content
- **Payment**: Stripe (subscriptions + one-time)
- **Email**: Resend
- **Push**: OneSignal Web Push
- **Tracking**: Facebook Pixel + Conversions API (via Stape.io server-side GTM)
- **Error Monitoring**: Sentry
- **Deployment**: Vercel (frontend) + Railway (backend) + Supabase (DB)

## Repository Structure
```
/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # NestJS backend
├── packages/
│   ├── shared/           # Shared TS types, constants
│   └── db/               # Prisma schema + migrations
├── docs/                 # Architecture docs and tickets
├── AGENTS.md             # This file
└── package.json          # pnpm workspace
```

Use **pnpm workspaces** as the monorepo tool. Use **pnpm** for all package management.

## Code Standards

### General
- TypeScript strict mode ON, no `any` unless justified with comment
- ESLint + Prettier configured, run on commit (Husky + lint-staged)
- All commits follow Conventional Commits: `feat:`, `fix:`, `chore:`, etc.
- Branch naming: `feature/<ticket-id>-short-desc`, `fix/<ticket-id>-short-desc`

### Frontend
- Server Components by default, `'use client'` only when necessary
- All forms use `react-hook-form` + `zod` validation
- API calls via React Query, never raw fetch in components
- Mobile-first responsive design, breakpoints: `sm:640`, `md:768`, `lg:1024`
- All user-facing strings in `messages/en.json` (next-intl ready), no hardcoded strings
- Loading states must use Suspense + skeleton UI, no spinners on full pages

### Backend
- All endpoints use DTO classes with `class-validator` decorators
- Database access via Prisma, no raw SQL unless justified
- All business logic in service layer, controllers thin
- Errors via `HttpException` subclasses, never throw raw Error
- Every endpoint must have OpenAPI/Swagger annotations
- Rate limiting via `@nestjs/throttler` on all public endpoints

### Security
- All API routes require auth EXCEPT: register, login, public book/chapter listing, free chapters, health check
- JWT in HTTP-only secure cookie, NOT localStorage
- Passwords hashed with bcrypt, cost factor 12
- Stripe webhook signature verification mandatory
- All chapter content URLs must be signed (presigned R2 URLs, 1h expiry)
- Input validation on every endpoint, even if frontend validates

### Database
- All tables have `id` (UUID v4), `created_at`, `updated_at`
- Soft deletes via `deleted_at` for users, books, chapters
- Indexes on all foreign keys and frequent query fields
- Migrations via Prisma Migrate, never edit DB directly

## Testing Requirements
- Backend: Jest unit tests for all services, e2e tests for critical flows (auth, payment, unlock)
- Frontend: Playwright e2e for: register → read → paywall → checkout
- Minimum 70% coverage on backend services
- Test files co-located: `service.ts` + `service.spec.ts`

## Important Domain Rules

### Chapter Unlock Logic
1. If `chapter.is_free` → readable by anyone (incl. guests)
2. If user has active subscription → readable
3. If user already unlocked this chapter (in `chapter_unlocks` table) → readable
4. Otherwise → blocked, show paywall

### Subscription States
- `active`: paid and within period
- `past_due`: payment failed but in grace period (3 days)
- `canceled`: user canceled, but still active until `current_period_end`
- `expired`: period ended, no renewal

### Coin Transactions
- Every change to `user.coin_balance` MUST create a `coin_transactions` row
- Use database transaction to ensure atomicity
- Negative `amount` = spend, positive = earn

### FB Event Tracking
- Every tracked event has a UUID `event_id`
- Frontend Pixel and backend CAPI MUST send the same `event_id` for the same logical event
- Backend always sends CAPI as source of truth for purchase/subscribe events
- Log every CAPI call to `fb_events` table for debugging

## Environment Variables
All env vars documented in `.env.example`. Never commit real secrets. Required vars:

```
# Database
DATABASE_URL=
REDIS_URL=

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_WEEKLY=
STRIPE_PRICE_MONTHLY=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=

# Tracking
NEXT_PUBLIC_FB_PIXEL_ID=
FB_CAPI_ACCESS_TOKEN=
FB_TEST_EVENT_CODE=

# Email
RESEND_API_KEY=

# Push
NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=

# Misc
NEXT_PUBLIC_APP_URL=
NODE_ENV=
SENTRY_DSN=
```

## What NOT to Do
- Do NOT add features not in the current ticket
- Do NOT change tech stack
- Do NOT install new dependencies without approval (note in PR description)
- Do NOT use `any` type without justification
- Do NOT skip tests
- Do NOT commit `.env` files
- Do NOT use localStorage for auth tokens
- Do NOT hardcode strings, prices, or URLs

## Definition of Done
A ticket is done when:
1. Code matches ticket acceptance criteria
2. Tests written and passing
3. Lint + typecheck clean
4. Manual smoke test passed
5. PR opened with description of changes
6. No console.log or debug code left

## How to Use Tickets
- Tickets are in `docs/tickets/` numbered 01–14
- Work them in order; later tickets depend on earlier ones
- Each ticket is a self-contained scope; do not bleed work across tickets
- When starting a ticket, create branch `feature/<id>-<slug>`
- After completing, open PR titled `feat(<scope>): <ticket title>` and reference the ticket file
