# Production Runbook

## Architecture Summary

NovelHub runs a Next.js PWA frontend on Vercel and a NestJS API on Railway. The API owns database writes, auth cookies, Stripe, OneSignal, Resend, Facebook CAPI, Redis caching, and Cloudflare R2 signed chapter access; the web app talks to it through cookie-authenticated requests and serves public reading, checkout, PWA, legal, account, and admin experiences.

## Production Environment Variables

Use `.env.example` as the source of truth. Production must define these values in the relevant platform secret stores:

```sh
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_WEEKLY=
STRIPE_PRICE_MONTHLY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=
NEXT_PUBLIC_FB_PIXEL_ID=
FB_CAPI_ACCESS_TOKEN=
FB_TEST_EVENT_CODE=
RESEND_API_KEY=
EMAIL_FROM=
SUPPORT_EMAIL=
SUPPORT_FROM_EMAIL=
NEXT_PUBLIC_SUPPORT_EMAIL=
NEXT_PUBLIC_DMCA_EMAIL=
R2_PUBLIC_HOST=
NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_IMAGE_HOST=
NEXT_PUBLIC_R2_PUBLIC_HOST=
NODE_ENV=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT_WEB=
SENTRY_PROJECT_API=
```

Do not commit real secret values. Set `NODE_ENV=production` in both production apps.

## Deploy Flow

Vercel deploys `apps/web` from `main` using the Next.js standalone build. Railway deploys `apps/api` from `main` using `apps/api/Dockerfile`.

Production deploys intentionally use the native Git repository integrations in Vercel and Railway. When those projects are connected to this repository and configured to auto-deploy from `main`, no GitHub Actions production deploy workflow is required; the CI gates stay in GitHub Actions, and each platform owns its own production rollout.

**Migrations run as a separate pre-deploy step, not in the API container ENTRYPOINT.** Running `prisma migrate deploy` at every container start makes every replica race for the Prisma advisory lock on horizontal scale-out, and a failed migration crash-loops every replica simultaneously instead of failing once and surfacing cleanly.

Configure the deploy platform to run, before rolling out the new image:

```sh
pnpm --filter @novelhub/db exec prisma migrate deploy --schema prisma/schema.prisma
```

- **Railway:** set this as the project's Pre-Deploy Command. Railway runs it once per deploy; the new replica only goes live when the migration step exits 0.
- **Other platforms:** run it as a dedicated GitHub Actions deploy job, a `release` Procfile entry, or a one-shot k8s Job — whatever the platform's idiom for "exactly-once per release" is.

If the migration step fails, the deploy halts before any new replica is rolled out. The previous image keeps serving until you fix the migration. `staging-deploy.yml` already exists for the separate staging VPS flow; that path runs migrations inside the deploy script for the same reason.

Operational setup after merge remains manual: create and connect Vercel, Railway, Supabase, Upstash, Cloudflare, Stripe live-mode, Meta Business Manager, Sentry, UptimeRobot, and Discord or Slack alerting.

## Rollback

Use Vercel's deployment history to roll the web app back to the previous successful deployment.

Use Railway's deployment history to roll the API back to the previous image.

Database rollback is harder than image rollback. Destructive migrations must ship only with a reviewed manual reverse-migration plan, backup confirmation, and an agreed recovery window before they reach production.

## Backup Strategy

Supabase Pro projects ship with automatic daily Postgres backups out of the box. Document, verify, and operate them as follows:

- **Storage.** Supabase stores backups in their managed infrastructure; they are not in this repository. The Supabase dashboard surfaces them under Project Settings → Database → Backups.
- **Retention.** Daily backups are retained for 7 days on the Pro plan (review the active plan on Supabase to confirm). For longer retention enable Point-in-Time Recovery (PITR) which extends to 7–30 days depending on plan.
- **RPO / RTO.** RPO is up to 24 hours without PITR (the gap between daily snapshots). RTO is "minutes to a few hours" for Supabase-managed restores. Document the active values once Supabase is provisioned.
- **Who restores.** The on-call engineer triggers a restore from the Supabase dashboard, or via `supabase db restore` when it lands on the CLI. They must coordinate with stakeholders before a destructive restore because it replaces the entire database state.
- **Partial vs. full restore.**
  - _Full restore_ — Supabase replaces the entire database from the chosen snapshot. Schedule a write-freeze on the API (`fly scale 0` / Railway pause) before triggering, and verify migrations are at the expected version after restore.
  - _Partial restore_ — Supabase does not natively support per-table restore. The supported workflow is: clone the snapshot to a one-shot recovery branch, dump the affected tables with `pg_dump --table`, then merge into the live database with conflict-resolution scripts. Document the affected rows in the postmortem.
- **Verification cadence.** A weekly cron exports the latest backup to a recovery-only branch and runs `prisma migrate status` against it. Track the result in the on-call rotation channel — silent backup pipelines must be assumed broken.
- **Out of scope here.** Cross-region replication and DR runbooks are not part of Ticket 14 (see ticket Out of Scope). Add them when traffic warrants the cost.

## Common Issues

Stripe webhook 400s: verify `STRIPE_WEBHOOK_SECRET`, confirm the endpoint is the live-mode webhook URL, and check that `/payments/webhook` still receives the raw request body.

Login works locally but fails in production: confirm `NEXT_PUBLIC_APP_URL`, CORS origin, secure cookie settings, and the production domain.

Chapter content 403s: confirm `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, and that chapter objects remain private while API-generated presigned URLs are valid for one hour.

Cover images do not render: confirm production cover objects are public-readable and `R2_PUBLIC_HOST`, `NEXT_PUBLIC_IMAGE_HOST`, and `NEXT_PUBLIC_R2_PUBLIC_HOST` match the Cloudflare hostname.

OneSignal pushes silent: confirm `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, real-device subscription state, and the service worker scope conflict tracked in #46.

Facebook events do not deduplicate: confirm frontend Pixel and backend CAPI share the same `event_id`, `NEXT_PUBLIC_FB_PIXEL_ID`, `FB_CAPI_ACCESS_TOKEN`, and Meta AEM priority settings.

Sentry is quiet: confirm Sentry projects exist, `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set, and `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_WEB`, and `SENTRY_PROJECT_API` are configured if source-map upload is expected.

## Pre-Launch QA Checklist

- [ ] Register new account, get welcome email
- [ ] Login with email and Google
- [ ] Browse home, all categories
- [ ] Open book detail, view chapter list
- [ ] Read first 3 free chapters as guest
- [ ] Hit paywall on chapter 4
- [ ] Sign up from paywall, redirected back
- [ ] Buy coin package, verify coins added
- [ ] Unlock chapter with coins
- [ ] Subscribe weekly, verify unlimited access
- [ ] Cancel subscription via portal, verify access until period end
- [ ] Check FB Events Manager, all events firing with dedup
- [ ] Test push notification subscribe and receive
- [ ] Install PWA on iOS and Android
- [ ] Lighthouse mobile: Performance > 85, PWA > 90, Accessibility > 90
- [ ] All legal pages accessible
- [ ] Cookie consent works
- [ ] Admin panel functional
- [ ] Site loads at production URL with valid SSL
- [ ] Stripe live test purchase works, then refund it
- [ ] FB Pixel verified active in Meta Business Manager
- [ ] Sentry receives test errors from both apps
- [ ] Supabase automatic backups are enabled
- [ ] Initial production data upload contains 15 books with full chapter sets

## Operational Checklist

- [ ] Create Vercel project and production env vars
- [ ] Create Railway project and production env vars
- [ ] Create Supabase production Postgres project
- [ ] Create Upstash or Railway Redis instance
- [ ] Create production R2 bucket; covers public-read, chapters private
- [ ] Configure DNS, SSL, and Cloudflare page rules
- [ ] Configure Stripe live-mode products and webhook
- [ ] Verify domain in Meta Business Manager and configure AEM priority
- [ ] Create Sentry projects, DSNs, and source-map upload token
- [ ] Verify Lighthouse scores on the production URL
- [ ] Test push notifications on real iOS and Android devices
- [ ] Configure Discord or Slack webhook and UptimeRobot monitor
