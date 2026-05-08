# Production Runbook — Phase 1 Launch

This runbook covers the **Phase 1 low-cost launch**: smallest viable infrastructure that supports a Meta-driven paid acquisition test with live Stripe, real error tracking, and basic uptime monitoring. Phase 2 expansions (Upstash Redis, OneSignal Push, Discord/Slack alerting, full staging) are listed at the end and intentionally deferred until traffic justifies the cost.

## Architecture Summary

| Service                       | Role                                                                   | Phase 1 plan                                               |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Vercel                        | Hosts `apps/web` (Next.js PWA)                                         | Hobby ($0) → Pro ($20/mo) when traffic justifies           |
| Railway                       | Hosts `apps/api` (NestJS, single replica)                              | Hobby ($5/mo)                                              |
| Supabase                      | Postgres + automated backups                                           | Free → Pro ($25/mo) when PITR or 7-day retention is needed |
| Cloudflare R2                 | Object storage: covers (public) + chapter content (private, presigned) | Free tier (10 GB, $0 egress)                               |
| Stripe (Live Mode)            | Subscriptions + coin packages                                          | Pay-as-you-go                                              |
| Meta Business Manager + Pixel | Pixel + Conversions API                                                | Free                                                       |
| Sentry                        | Error tracking (web + api projects)                                    | Free tier (5k errors/mo)                                   |
| UptimeRobot                   | Uptime + content monitors                                              | Free (50 monitors, 5 min)                                  |

Cron jobs (re-engagement, renewal reminders) run inside the Railway API process and use Postgres advisory locks for leader election; they do **not** require Redis.

## First Launch Checklist

Walk through these in order. Each section ends with a verification step.

### 1. Supabase

1. Create project on free tier; pick a region close to your Railway region.
2. Once provisioned, go to **Settings → Database → Connection String → URI**, pick **"Transaction"** pooler mode (port `6543`), and copy the URI.
3. Append `?pgbouncer=true&connection_limit=1` so Prisma plays nicely with PgBouncer.
4. Save as `DATABASE_URL` in Railway (next step).
5. **Verify**: after Railway is up, the API logs print `Nest application successfully started` and `GET /health` returns `db: ok`.

### 2. Cloudflare R2

1. Create a bucket — e.g. `novelhub-content`.
2. **Settings → Public access**: leave bucket private. Do **not** flip "Public Bucket".
3. **Settings → Custom Domains**: bind a Cloudflare-routed domain like `cdn.novelhub.example`. (Cloudflare proxies through your domain instead of `*.r2.cloudflarestorage.com`.)
4. Make `covers/*` public-readable: easiest path is the Cloudflare Workers / Transform Rules approach to set `cache-control: public, max-age=86400` on the prefix. Chapter content under `books/<key>/...` stays private and is served via API-issued presigned URLs.
5. Generate an R2 API token (Cloudflare Dashboard → R2 → Manage R2 API Tokens). Permissions: **Object Read & Write**, scoped to the bucket. Save the access key + secret to Railway as `R2_ACCESS_KEY` / `R2_SECRET_KEY`.
6. **Verify**: upload one cover via the admin panel after launch; the URL `https://cdn.novelhub.example/covers/<uuid>` should render in `next/image` without a "hostname not configured" error (next.config.mjs reads `NEXT_PUBLIC_IMAGE_HOST`).

### 3. Vercel (web)

1. Connect the GitHub repo to a new Vercel project.
2. **Project Settings → General**:
   - Root Directory = `apps/web`
   - Build Command = leave empty (auto: `pnpm --filter @novelhub/web build`)
   - Install Command = `pnpm install`
   - Output Directory = leave empty (auto-detected from `next` standalone build)
3. **Project Settings → Environment Variables** — add the values listed in [Production Environment Variables](#production-environment-variables) below, scoping each to **Production** only (Preview deploys can stay with placeholder API URLs).
4. **Project Settings → Domains** — add the production domain; set DNS A/CNAME records as instructed; Vercel auto-provisions SSL.
5. **Deploy**: push to `main` or click "Redeploy". The first build should succeed in ~3 minutes.
6. **Verify**: visit `https://novelhub.example/` — the home page renders with seeded books, the manifest at `/manifest.json` loads, and PWA install prompt appears on iOS / Android.

### 4. Railway (api)

1. Connect the GitHub repo to a new Railway project; choose **Deploy from Dockerfile** with path `apps/api/Dockerfile`.
2. **Settings → Source Repo**:
   - Watch Paths: `apps/api/**` and `packages/**`
   - Production Branch: `main`
3. **Settings → Deploy**:
   - **Pre-Deploy Command** (critical — see [Deploy Flow](#deploy-flow)):
     ```sh
     pnpm --filter @novelhub/db prisma:migrate-deploy
     ```
   - **Healthcheck Path**: `/health`
   - **Healthcheck Timeout**: 30s
   - **Replicas**: 1 (Phase 1 — do not horizontal-scale; cron leader election + advisory locks are correct for that case but unnecessary at this volume)
4. **Variables** — paste in the api env block from [Production Environment Variables](#production-environment-variables).
5. **Settings → Domains** — generate a Railway-provided domain or bind a custom domain like `api.novelhub.example`. Update Vercel's `NEXT_PUBLIC_API_URL` to match.
6. **Verify**: `curl https://api.novelhub.example/health` returns `{ "status": "ok", "db": "ok", … }`. `https://api.novelhub.example/docs` shows the Swagger UI.

### 5. Stripe (Live Mode)

1. **Stripe Dashboard → toggle "View test data" OFF** (you are now in live mode).
2. Run `pnpm stripe:setup` locally with `STRIPE_SECRET_KEY=sk_live_...` exported. The script creates the four coin packages and two subscription plans and prints their price IDs. Copy them into Railway env: `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_MONTHLY` (coin package IDs are baked into `packages/shared`).
3. **Webhooks → Add endpoint**:
   - URL: `https://api.novelhub.example/payments/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `charge.refunded`
4. After creating, copy the **Signing secret** (`whsec_...`) into Railway as `STRIPE_WEBHOOK_SECRET`.
5. **Verify**: in Stripe Dashboard → Webhooks → click your endpoint → "Send test webhook" with `checkout.session.completed`. Railway logs should show the event handler executing; Stripe shows a `200` response.

### 6. Meta Business Manager / Pixel

1. **Business Settings → Brand Safety → Domains** — add `novelhub.example` and verify via DNS TXT or meta tag.
2. **Events Manager → Data Sources → Add → Web** — create a Pixel; copy its ID into Vercel `NEXT_PUBLIC_FB_PIXEL_ID`.
3. **Events Manager → your Pixel → Settings → Conversions API** — generate an access token. Copy to Railway `FB_CAPI_ACCESS_TOKEN`. Leave `FB_TEST_EVENT_CODE` **empty** in production.
4. **Events Manager → your Pixel → Aggregated Event Measurement** — set the 8 priority events. Suggested priority (highest first): Purchase, Subscribe, AddToCart, InitiateCheckout, ViewContent, CompleteRegistration, Lead, PageView.
5. **Verify**: install the Meta Pixel Helper Chrome extension. Load `https://novelhub.example/` — should fire `PageView`. Open a book detail page — should fire `ViewContent`. In Events Manager → Test Events, the same events appear with both **browser** and **server** sources, deduped by `event_id`.

### 7. Sentry

1. Create a Sentry org (if not already).
2. Create two projects:
   - `novelhub-web` (platform: Next.js)
   - `novelhub-api` (platform: Node.js)
3. Copy the DSNs into env (`NEXT_PUBLIC_SENTRY_DSN` for web, `SENTRY_DSN` for api).
4. **Settings → Auth Tokens → Create New Token** — scope `project:releases` + `project:write`. Copy as `SENTRY_AUTH_TOKEN` to **both** Vercel and Railway env (build-time only). Set `SENTRY_ORG` to the org slug, `SENTRY_PROJECT_WEB`/`SENTRY_PROJECT_API` to the project slugs.
5. **Verify**: trigger a hand-thrown error (the smoke script's "test error" path, or simply `throw new Error('sentry-smoke-test')` from a one-off endpoint). The error should appear in the matching Sentry project within 60s with PII fields scrubbed.

### 8. UptimeRobot

Create 4 free-tier monitors (5-min interval):

| Monitor              | URL                                                        | Type                         | Expected         |
| -------------------- | ---------------------------------------------------------- | ---------------------------- | ---------------- |
| Web home             | `https://novelhub.example/`                                | HTTP(s)                      | 200              |
| API health           | `https://api.novelhub.example/health`                      | HTTP(s), keyword `"db":"ok"` | 200 + body match |
| Books endpoint       | `https://api.novelhub.example/books?limit=1`               | HTTP(s)                      | 200              |
| Payment success page | `https://novelhub.example/payment/success?session_id=test` | HTTP(s)                      | 200              |

Add an alert contact (email is fine for Phase 1; add Slack/Discord in Phase 2).

## Production Environment Variables

Source of truth: `.env.example`. Each variable's deployment scope is annotated there as `[V]` (Vercel), `[R]` (Railway), `[VR]` (both), or `[L]` (local only).

**Pre-flight check**: before pushing the first deploy, grep your env:

```sh
# These MUST match these patterns in production:
[[ "$STRIPE_SECRET_KEY" == sk_live_* ]] || echo "WARN: not a live key"
[[ -z "$NEXT_PUBLIC_DEV_ALLOW_API_CONTENT" ]] || echo "WARN: dev escape hatch is on in prod"
[[ -z "$FB_TEST_EVENT_CODE" ]] || echo "WARN: FB events going to test stream"
[[ "$NODE_ENV" == "production" ]] || echo "WARN: not production NODE_ENV"
```

## Deploy Flow

Vercel deploys `apps/web` and Railway deploys `apps/api` from `main` via their native Git integrations. No GitHub Actions production deploy workflow is required.

**Migrations run as a separate Pre-Deploy step, not in the API container ENTRYPOINT.** Running `prisma migrate deploy` at every container start makes every replica race for the Prisma advisory lock at horizontal scale-out, and a failed migration crash-loops every replica simultaneously. Phase 1 runs a single replica, but the discipline keeps Phase 2 free.

Railway's **Pre-Deploy Command**:

```sh
pnpm --filter @novelhub/db prisma:migrate-deploy
```

If the migration step exits non-zero, Railway halts the rollout and the previous image keeps serving. Roll forward by fixing the migration; do not bypass.

## Rollback

| Layer         | How                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel (web)  | Deployments → previous green build → "Promote to Production"                                                                                     |
| Railway (api) | Deployments → previous → "Redeploy"                                                                                                              |
| Database      | Supabase → Project Settings → Database → Backups → Restore. **Stop the API first** (Railway → Settings → Pause) so writes don't race the restore |

Database rollback is destructive. Destructive migrations must ship only with a reviewed manual reverse-migration plan and stakeholder sign-off — see Backup Strategy.

## Backup Strategy

Supabase Pro projects ship with automatic daily Postgres backups. Phase 1 should upgrade to Pro the moment real users arrive.

- **Storage**: Supabase-managed; surfaced under Project Settings → Database → Backups.
- **Retention**: 7 days on Pro. Enable PITR (Point-in-Time Recovery) for 7–30 days.
- **RPO / RTO**: RPO ≤ 24h without PITR; RTO is "minutes to a few hours" for Supabase-managed restores.
- **Restore procedure**: pause the Railway API → trigger restore in Supabase dashboard → run `prisma migrate status` against the restored DB to confirm migration version → unpause API.
- **Verification cadence**: weekly — clone the latest backup to a recovery branch, run `prisma migrate status`, document the result.

## Monitoring & Alerts

| Channel                 | Source                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Frontend errors         | Sentry `novelhub-web`                                                                              |
| Backend errors          | Sentry `novelhub-api`                                                                              |
| Uptime                  | UptimeRobot (4 monitors)                                                                           |
| Stripe webhook failures | Stripe Dashboard → Webhooks → endpoint → "Recent deliveries" (alerts via email when sustained 5xx) |
| Meta event quality      | Events Manager → Test Events + Match Quality                                                       |
| DB                      | Supabase Dashboard → Reports                                                                       |

Sentry's built-in email alert is enough for Phase 1; route both projects to the on-call email. Add Slack/Discord webhook in Phase 2.

## Common Issues

**Stripe webhook 400s** — verify `STRIPE_WEBHOOK_SECRET` matches the live webhook's signing secret (test-mode secrets do **not** validate live events), confirm the endpoint URL is correct, and check `apps/api/src/main.ts` still configures `rawBody: true` (the Nest app needs the raw request body to validate the signature).

**Login works locally but fails in production** — confirm `NEXT_PUBLIC_APP_URL`, the API's CORS origin, secure cookie settings, and the production domain on the JWT cookie path.

**Chapter content 403s** — confirm `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`. Chapter objects must remain private; API-generated presigned URLs are valid for 1 hour.

**Cover images do not render** — confirm `R2_PUBLIC_HOST` (backend) and `NEXT_PUBLIC_R2_PUBLIC_HOST` / `NEXT_PUBLIC_IMAGE_HOST` (frontend) all point at the **same** Cloudflare custom domain.

**Facebook events do not deduplicate** — confirm the frontend Pixel and backend CAPI share the same `event_id` per request. The web client generates `event_id` and passes it to both; if the server ignores or regenerates, dedup breaks. Re-check `apps/api/src/modules/fb-capi/`.

**Sentry is quiet** — confirm `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set, and `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT_*` are populated for source-map upload (build-time variables).

**`/health` returns `db: fail`** — Railway's Pre-Deploy migration probably succeeded but the connection pool is misconfigured. Check `DATABASE_URL` includes `?pgbouncer=true&connection_limit=1` for Supabase.

## Phase 2 — Deferred

These are intentionally not part of Phase 1. Re-evaluate when the listed condition is met.

| Item                                                  | Trigger to enable                              | How                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Upstash Redis                                         | DAU > 1k or `/books` p95 > 500ms               | Provision Upstash → set `REDIS_URL` in Railway. Code auto-enables cache, no diff                            |
| OneSignal Push                                        | First retention campaign / re-engagement push  | Set `NEXT_PUBLIC_ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY`. Real-device verify the SW scope fix from #46 |
| Discord/Slack alerts                                  | Second P1 incident                             | Sentry → Alerts → Webhook integration                                                                       |
| Full staging environment                              | Team > 2 people                                | Configure `STAGING_*` secrets in GitHub; `staging-deploy.yml` and `staging-healthcheck.yml` already exist   |
| GitHub Actions production deploy with manual approval | Team > 2 people / regulated change-control     | Disable Vercel/Railway auto-deploy; add `production-deploy.yml` with `environment: production` gate         |
| Sentry Performance / Profiling                        | Real performance investigation                 | Bump `tracesSampleRate` from 0.1 → 1.0; enable profiling SDK                                                |
| Cross-region read replicas                            | Multi-region traffic / GDPR data residency     | Supabase → Read Replicas                                                                                    |
| Independent worker / queue                            | Cron count > 5 or single-task duration > 1 min | BullMQ + Upstash; extract from the NestJS monolith                                                          |
