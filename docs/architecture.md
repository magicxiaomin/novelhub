# Architecture

## System Diagram

```text
User Browser / PWA
        |
        v
Vercel: Next.js standalone web app  <---->  Railway: NestJS API
                                                   |
                                                   +--> Supabase Postgres via Prisma
                                                   +--> Upstash Redis
                                                   +--> Cloudflare R2
                                                   +--> Stripe
                                                   +--> OneSignal
                                                   +--> Resend
                                                   +--> Facebook Graph API / CAPI

GitHub Actions
        |
        +--> GitHub-hosted PR checks: lint, test, build, typecheck
        +--> Self-hosted runner: Claude review workflows
```

## Key Boundaries

Users authenticate with JWTs in HttpOnly secure cookies. Do not use localStorage for auth tokens and do not introduce Bearer-token auth for browser user flows.

Access tokens and refresh tokens are cookie-based. Refresh stays server-mediated through the API.

Stripe webhooks depend on the raw request body at `/payments/webhook`; do not add body parsers or middleware that consume that body before signature verification.

Admin endpoints are protected by `JwtAuthGuard` plus `AdminGuard` and the global throttler. Keep admin business logic in services and controllers thin.

Chapter content is private in R2 and read through API-issued presigned URLs. Cover images are public through the configured R2 public host.

The frontend uses server components by default, React Query for server state, Zustand for client state, and `messages/en.json` for user-facing strings.

## Ticket Trace

Tickets 01-13 are merged into `main` and define the production feature set that Ticket 14 deploys:

- Ticket 01: monorepo foundation and workspace scripts
- Ticket 02: database schema and Prisma setup
- Ticket 03: API skeleton, health, validation, and Swagger
- Ticket 04: auth, cookies, registration, login, and Google auth
- Ticket 05: public catalog and book/chapter browsing
- Ticket 06: reader and chapter access flow
- Ticket 07: paywall and chapter unlock logic
- Ticket 08: Stripe subscriptions and coin purchases
- Ticket 09: Facebook Pixel and Conversions API tracking
- Ticket 10: admin book and chapter management
- Ticket 11: PWA, install prompts, and push notification client flow
- Ticket 12: email, support, legal, and compliance pages
- Ticket 13: staging, health checks, and operational scaffolding

Ticket 14 adds production Dockerfiles, always-on PR checks, Sentry wiring, and these production operations docs. External account setup, DNS, live Stripe, Meta verification, Lighthouse validation, production content upload, and uptime or chat alert setup remain manual operational work.
