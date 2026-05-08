# Production Runbook — Phase 1 Launch

This runbook covers the **Phase 1 low-cost launch**: smallest viable infrastructure that supports a Meta-driven paid acquisition test with live Stripe, real error tracking, and basic uptime monitoring. Phase 2 expansions (Railway / dedicated container host, Upstash Redis, OneSignal Push, Discord/Slack alerting, full staging) are listed at the end and intentionally deferred until traffic justifies the cost.

**Phase 1 deploys both apps on Vercel. No Railway, no separate container host.** The NestJS API runs as a Vercel Serverless Function via the adapter at `apps/api/api/[...path].ts`; cron jobs trigger via Vercel Cron Jobs hitting `apps/api/api/cron/*.ts`. Total Phase 1 fixed cost: **$0** (everything on free tiers).

> **Cutover in progress (2026-05-08).** The Cloudflare migration plan is shipped end-to-end as code (Tasks 1–14 merged); the production cutover is still pending Stripe Dashboard + DNS access, both of which only the project owner can do. The step-by-step is in [§ Cloudflare cutover playbook](#cloudflare-cutover-playbook--phase-2-launch) below. Once that completes, Task 16 will rewrite this Phase 1 section out and promote the Cloudflare path to the only documented flow.

## Architecture Summary

| Service                       | Role                                                                            | Phase 1 plan                                                |
| ----------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Vercel `novelhub-web`         | Hosts `apps/web` (Next.js PWA)                                                  | Hobby ($0) → Pro ($20/mo) when traffic justifies            |
| Vercel `novelhub-api`         | Hosts `apps/api` (NestJS as Serverless Functions) + Vercel Cron Jobs            | Hobby ($0) → Pro ($20/mo) if cold-starts hurt or cron quota |
| Supabase                      | Postgres + automated backups                                                    | Free → Pro ($25/mo) when PITR or 7-day retention is needed  |
| Cloudflare R2                 | Object storage: covers (public) + chapter content (private, presigned)          | Free tier (10 GB, $0 egress)                                |
| Stripe (Live Mode)            | Subscriptions + coin packages                                                   | Pay-as-you-go                                               |
| Meta Business Manager + Pixel | Pixel + Conversions API                                                         | Free                                                        |
| Sentry                        | Error tracking (web + api projects)                                             | Free tier (5k errors/mo)                                    |
| UptimeRobot                   | Uptime + content monitors                                                       | Free (50 monitors, 5 min)                                   |
| GitHub Actions                | `migrate-on-deploy.yml` runs `prisma migrate deploy` before each Vercel rollout | Free                                                        |

Cron jobs (re-engagement every 6h, renewal-reminder daily 9am) are scheduled by **Vercel Cron** in `apps/api/vercel.json`. Each cron tick is an HTTP request to `/api/cron/*`, authenticated by a shared `CRON_SECRET` bearer. The in-process `@nestjs/schedule` decorators are gated by `CRON_DRIVER=vercel` (set in production env) so they don't double-fire.

## Cloudflare cutover playbook — Phase 2 launch

Once the project owner has access to the Stripe Dashboard and the domain registrar, walk this top-to-bottom. Each stage is independent: stop after any stage and the previous stages remain valid; resume any time. The full migration plan + per-task PR list lives in [`docs/cloudflare-migration-phase0.md`](./cloudflare-migration-phase0.md).

### Stage 1 — Cloudflare account setup

1. **Workers projects.** Cloudflare Dashboard → Workers & Pages → Create. Names must match `apps/api/wrangler.toml`:
   - `novelhub-api` (matches `[env.production].name`)
   - `novelhub-api-staging` (matches `[env.staging].name`)
2. **Pages project.** Workers & Pages → Create → Pages → name it `novelhub-web`. Settings → Functions → Compatibility flags → enable `nodejs_compat` (required by `@sentry/nextjs`'s edge bundle).
3. **Hyperdrive binding** (Postgres pooler at the edge). From a local terminal:
   ```sh
   wrangler hyperdrive create novelhub-pg \
     --connection-string='postgresql://USER:PASS@HOST:5432/DB'
   ```
   Use the Supabase **Direct** URL (port 5432), not the pooler. Note the printed `id`.
4. **KV namespace** (support rate-limit):
   ```sh
   wrangler kv namespace create novelhub-kv
   ```
   Note the `id`.
5. **Wire the bindings.** Edit `apps/api/wrangler.toml`: uncomment the `[[hyperdrive]]` and `[[kv_namespaces]]` blocks and paste the IDs from steps 3–4. Open a small PR (`feat(api): wire Hyperdrive + KV bindings`).
6. **API token.** dash.cloudflare.com → My Profile → API Tokens → Create Token. Permissions: `Workers Scripts:Edit`, `Workers KV Storage:Edit`, `Workers R2 Storage:Edit`. Save the token — it's only shown once.

### Stage 2 — GitHub Actions secrets

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret                           | Value                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `PRODUCTION_DATABASE_URL_DIRECT` | Same value as the existing `PRODUCTION_DATABASE_URL` (Supabase Direct URL, port 5432). Migrations skip without it. |
| `CLOUDFLARE_API_TOKEN`           | From Stage 1 step 6.                                                                                               |
| `CLOUDFLARE_ACCOUNT_ID`          | dash.cloudflare.com home → right sidebar.                                                                          |
| `STAGING_ADMIN_EMAIL`            | Optional — used by post-deploy smoke against staging. Skipped when unset.                                          |
| `STAGING_ADMIN_PASSWORD`         | Optional — paired with `STAGING_ADMIN_EMAIL`. Use a non-rotating staging-only credential.                          |
| `PRODUCTION_ADMIN_EMAIL`         | Optional — used by post-deploy smoke against production. Skipped when unset.                                       |
| `PRODUCTION_ADMIN_PASSWORD`      | Optional — paired with `PRODUCTION_ADMIN_EMAIL`.                                                                   |

GitHub repo → Settings → Secrets and variables → Actions → Variables:

| Variable                              | Value                                                                                                                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRODUCTION_LIVE` (vars, NOT secrets) | `true` (set this AFTER stage 6 DNS cutover, AFTER you've confirmed the new stack is healthy. Until set, both workflows treat the production jobs as optional and skip cleanly.)                           |
| `STAGING_API_URL`                     | e.g. `https://novelhub-api-staging.<account>.workers.dev`. When set, `deploy-api.yml` runs `scripts/smoke.sh` against the deployed staging Worker (incl. R2 signed-URL round-trip) as a post-deploy gate. |
| `PRODUCTION_API_URL`                  | e.g. `https://api.novelhub.com`. When set, same smoke runs against production after a successful production deploy.                                                                                       |

### Stage 3 — Worker secrets

Pushed via `wrangler secret put` from a local terminal so deploy-time tokens stay off the GitHub runner. Repeat for `--env staging` then `--env production`:

```sh
cd apps/api
for SECRET in DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET JWT_RESET_SECRET \
              STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_WEEKLY \
              STRIPE_PRICE_MONTHLY SENTRY_DSN FB_CAPI_ACCESS_TOKEN \
              NEXT_PUBLIC_FB_PIXEL_ID RESEND_API_KEY EMAIL_FROM \
              R2_ACCOUNT_ID R2_ACCESS_KEY R2_SECRET_KEY R2_BUCKET \
              GOOGLE_CLIENT_ID ONESIGNAL_API_KEY ONESIGNAL_APP_ID \
              NEXT_PUBLIC_APP_URL; do
  wrangler secret put $SECRET --env <env>
done
```

For `DATABASE_URL` on the Worker: paste the **Hyperdrive** connection string (`wrangler hyperdrive list`), not the Supabase URL. The Worker connects to Postgres through Hyperdrive's edge pooler.

### Stage 4 — First deploy + staging smoke

1. GitHub Actions tab → "Deploy API (Cloudflare Workers)" → Run workflow → environment=`staging-only`.
2. Watch logs; staging deploys to `https://novelhub-api-staging.<account>.workers.dev`.
3. Smoke:
   ```sh
   API=https://novelhub-api-staging.<account>.workers.dev \
   ADMIN_EMAIL=admin@... ADMIN_PASSWORD=... \
     bash scripts/smoke.sh
   ```
   Expect 15/15 PASS.
4. If clean, re-run with environment=`both` (or push any commit to main; `migrate-on-deploy.yml` → `deploy-api.yml` chains automatically).

### Stage 5 — Stripe webhook cutover (Task 13)

1. Stripe Dashboard → Developers → Webhooks → existing endpoint → Edit destination URL to `https://api.novelhub.com/payments/webhook`. Use the workers.dev URL temporarily if pre-DNS.
2. "Reveal signing secret" → copy the new `whsec_...`.
3. Push to the Worker:
   ```sh
   cd apps/api
   wrangler secret put STRIPE_WEBHOOK_SECRET --env production
   # paste the new whsec
   ```
4. Stripe Dashboard → "Send test webhook" → `checkout.session.completed`. Confirm 200 in `wrangler tail --env production`.

### Stage 6 — DNS cutover (Task 15)

1. Edit `apps/api/wrangler.toml`: uncomment the `routes` lines for both `[env.staging]` and `[env.production]`. Push and let `deploy-api.yml` redeploy.
2. Cloudflare Dashboard → your domain → DNS → add `CNAME api → novelhub-api.<account>.workers.dev` (proxied, orange cloud).
3. Pages project → Custom domains → add `app.novelhub.com`.
4. Wait ~2 min for DNS propagation, then:
   ```sh
   API=https://api.novelhub.com \
   ADMIN_EMAIL=admin@... ADMIN_PASSWORD=... \
     bash scripts/smoke.sh
   ```
   Expect 15/15 PASS.

### Stage 7 — Vercel/VPS teardown (Task 16) and runbook rewrite (Task 19)

Once Stage 6's smoke passes against the real domain, the Phase 1 stack is dead weight. Tell Claude to land Task 16: delete `apps/api/api/`, `apps/api/vercel.json`, `apps/api/Dockerfile`, `.github/workflows/staging-deploy.yml`, `apps/api/src/main.ts`, `apps/api/src/instrument.ts`, every Nest `*.module.ts` / `*.controller.ts` / `*.guard.ts` / `*.interceptor.ts` / `*.filter.ts`, and rewrite this runbook so Phase 1 sections become history.

Pause Vercel Pro billing (if active) once the cutover holds for 24h.

## First Launch Checklist

Walk through these in order. Each section ends with a verification step.

### 1. Supabase

1. Create project on free tier; pick a region close to your Vercel region (US East / Frankfurt / Singapore).
2. Once provisioned, go to **Settings → Database** and capture **two** URIs:
   - **Pooler / Transaction mode** (port `6543`) — for the runtime API. Append `?pgbouncer=true&connection_limit=1`. This is `DATABASE_URL` in the Vercel `novelhub-api` project.
   - **Direct connection** (port `5432`) — for migration runs. This is `PRODUCTION_DATABASE_URL` in GitHub Actions secrets. **Never use the pooler URI for migrations** — `prisma migrate deploy` requires session-mode connections that pgbouncer transaction-mode breaks.
3. **Verify** (after API is up): the API logs print `Nest application successfully started` and `GET /health` returns `db: ok`.

### 2. Cloudflare R2

1. Create a bucket — e.g. `novelhub-content`.
2. **Settings → Public access**: leave bucket private. Do **not** flip "Public Bucket".
3. **Settings → Custom Domains**: bind a Cloudflare-routed domain like `cdn.novelhub.example`.
4. Make `covers/*` public-readable: easiest path is the Cloudflare Workers / Transform Rules approach to set `cache-control: public, max-age=86400` on the prefix. Chapter content under `books/<key>/...` stays private and is served via API-issued presigned URLs.
5. Generate an R2 API token (Cloudflare Dashboard → R2 → Manage R2 API Tokens). Permissions: **Object Read & Write**, scoped to the bucket. Save access key + secret to the Vercel `novelhub-api` project as `R2_ACCESS_KEY` / `R2_SECRET_KEY`.
6. **Verify**: upload one cover via the admin panel; `https://cdn.novelhub.example/covers/<uuid>` should render in `next/image` without a "hostname not configured" error (next.config.mjs reads `NEXT_PUBLIC_IMAGE_HOST`).

### 3. Vercel `novelhub-web` (frontend)

1. Connect the GitHub repo to a new Vercel project named `novelhub-web`.
2. **Project Settings → General**:
   - Root Directory = `apps/web`
   - Framework Preset = Next.js (auto)
   - Build Command = leave empty (auto: `pnpm --filter @novelhub/web build`)
   - Install Command = `pnpm install`
   - Output Directory = leave empty (auto)
3. **Project Settings → Environment Variables** — add the values listed in [Production Environment Variables](#production-environment-variables) tagged `[VW]` and `[BOTH]`, scoped to **Production** only.
4. **Project Settings → Domains** — add the production domain (e.g. `novelhub.example`); set DNS records as instructed. Vercel auto-provisions SSL.
5. **Deploy**: push to `main` triggers an auto-deploy.
6. **Verify**: visit `https://novelhub.example/` — the home page renders, `/manifest.json` loads, and PWA install prompt appears on mobile.

### 4. Vercel `novelhub-api` (backend)

1. Create a **second** Vercel project named `novelhub-api` from the same GitHub repo.
2. **Project Settings → General**:
   - Root Directory = `apps/api`
   - Framework Preset = **Other** (Vercel auto-detects the `vercel.json` and `api/*.ts` files)
   - Build Command = leave empty (`vercel.json` provides one: `pnpm --filter @novelhub/shared build && pnpm --filter @novelhub/db prisma:generate`)
   - Install Command = leave empty (`vercel.json` overrides to `pnpm install --frozen-lockfile`)
   - Output Directory = leave empty
3. **Project Settings → Environment Variables** — add values tagged `[VA]` and `[BOTH]`, scoped to **Production** only.
   - Set `CRON_DRIVER=vercel` (disables the in-process `@nestjs/schedule` so Vercel Cron is the only trigger).
   - Generate a 32+ character random string for `CRON_SECRET`.
4. **Project Settings → Domains** — bind a custom domain like `api.novelhub.example`. Update Vercel `novelhub-web`'s `NEXT_PUBLIC_API_URL` to match.
5. **Cron Jobs** — Vercel auto-discovers them from `vercel.json`. After the first deploy, **Project → Cron Jobs** lists:
   - `/api/cron/re-engagement` at `0 */6 * * *`
   - `/api/cron/renewal-reminders` at `0 9 * * *`
6. **Verify**:
   - `curl https://api.novelhub.example/health` returns `{ "status": "ok", "db": "ok", … }`
   - `https://api.novelhub.example/docs` shows the Swagger UI
   - Manual cron test: `curl -H "Authorization: Bearer $CRON_SECRET" https://api.novelhub.example/api/cron/re-engagement` returns `{"ok":true}`

### 5. Stripe (Live Mode)

1. **Stripe Dashboard → toggle "View test data" OFF** (you are now in live mode).
2. Run `pnpm stripe:setup` locally with `STRIPE_SECRET_KEY=sk_live_...` exported. The script creates the four coin packages and two subscription plans and prints their price IDs. Copy them into the `novelhub-api` Vercel env: `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_MONTHLY`.
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
4. After creating, copy the **Signing secret** (`whsec_...`) into the `novelhub-api` env as `STRIPE_WEBHOOK_SECRET`.
5. **Verify**: in Stripe Dashboard → Webhooks → click your endpoint → "Send test webhook" with `checkout.session.completed`. Vercel logs show the event handler executing; Stripe shows a `200` response.

### 6. Meta Business Manager / Pixel

1. **Business Settings → Brand Safety → Domains** — add `novelhub.example` and verify via DNS TXT or meta tag.
2. **Events Manager → Data Sources → Add → Web** — create a Pixel; copy its ID into Vercel `novelhub-web` `NEXT_PUBLIC_FB_PIXEL_ID`.
3. **Events Manager → your Pixel → Settings → Conversions API** — generate an access token. Copy to Vercel `novelhub-api` `FB_CAPI_ACCESS_TOKEN`. Leave `FB_TEST_EVENT_CODE` **empty** in production.
4. **Events Manager → your Pixel → Aggregated Event Measurement** — set the 8 priority events. Suggested order (highest first): Purchase, Subscribe, AddToCart, InitiateCheckout, ViewContent, CompleteRegistration, Lead, PageView.
5. **Verify**: Meta Pixel Helper Chrome extension on `https://novelhub.example/` fires `PageView`. In Events Manager → Test Events, the same events appear with both **browser** and **server** sources, deduped by `event_id`.

### 7. Sentry

1. Create a Sentry org (if not already).
2. Create two projects:
   - `novelhub-web` (platform: Next.js)
   - `novelhub-api` (platform: Node.js)
3. Copy the DSNs into env (`NEXT_PUBLIC_SENTRY_DSN` for web, `SENTRY_DSN` for api).
4. **Settings → Auth Tokens → Create New Token** — scope `project:releases` + `project:write`. Copy as `SENTRY_AUTH_TOKEN` to **both** Vercel projects (build-time only). Set `SENTRY_ORG` to the org slug, `SENTRY_PROJECT_WEB`/`SENTRY_PROJECT_API` to the project slugs.
5. **Verify**: trigger a hand-thrown error. Within ~60s the error appears in the matching Sentry project with PII fields scrubbed.

### 8. UptimeRobot

Create 4 free-tier monitors (5-min interval):

| Monitor              | URL                                                        | Type                         | Expected         |
| -------------------- | ---------------------------------------------------------- | ---------------------------- | ---------------- |
| Web home             | `https://novelhub.example/`                                | HTTP(s)                      | 200              |
| API health           | `https://api.novelhub.example/health`                      | HTTP(s), keyword `"db":"ok"` | 200 + body match |
| Books endpoint       | `https://api.novelhub.example/books?limit=1`               | HTTP(s)                      | 200              |
| Payment success page | `https://novelhub.example/payment/success?session_id=test` | HTTP(s)                      | 200              |

The 5-min API health probe also keeps the Vercel Function warm, mitigating cold-start latency for real users. Add an alert contact (email is fine for Phase 1; add Slack/Discord in Phase 2).

### 9. GitHub Actions migration secret

1. **Repo → Settings → Secrets and variables → Actions** — add a new secret `PRODUCTION_DATABASE_URL` with the Supabase **Direct connection** URI (port `5432`, NOT the pooler).
2. The `.github/workflows/migrate-on-deploy.yml` workflow will now run `prisma migrate deploy` on every push to `main`. Without this secret it skips with a log line.
3. **Verify**: push a no-op commit; the workflow run logs show `Applying migration ...` (or `No pending migrations` if up-to-date).

## Production Environment Variables

Source of truth: `.env.example`. Each variable's deployment scope is annotated there as `[VW]` (Vercel novelhub-web), `[VA]` (Vercel novelhub-api), `[BOTH]` (both projects), or `[L]` (local dev only).

**Pre-flight check**: before pushing the first deploy, grep your env values:

```sh
# These MUST match these patterns in production:
[[ "$STRIPE_SECRET_KEY" == sk_live_* ]] || echo "WARN: not a live key"
[[ -z "$NEXT_PUBLIC_DEV_ALLOW_API_CONTENT" ]] || echo "WARN: dev escape hatch is on in prod"
[[ -z "$FB_TEST_EVENT_CODE" ]] || echo "WARN: FB events going to test stream"
[[ "$CRON_DRIVER" == "vercel" ]] || echo "WARN: in-process cron will double-fire with Vercel Cron"
[[ -n "$CRON_SECRET" ]] || echo "WARN: cron endpoints are unauthenticated"
```

## Deploy Flow

Both Vercel projects auto-deploy from `main` via the native Git integration. No human-in-the-loop deploy step.

**Migrations run as a separate GitHub Actions step, not in the API runtime.** When `main` advances:

1. `migrate-on-deploy.yml` triggers in parallel with the Vercel deploys.
2. The action runs `pnpm --filter @novelhub/db prisma:migrate-deploy` against the Supabase **Direct connection** URI (`PRODUCTION_DATABASE_URL` secret).
3. Vercel deploys take ~3 minutes; migration runs take seconds — the migration finishes first in practice.
4. If the migration fails, the action job is red. Vercel still rolls out the new code (Vercel doesn't gate on external workflows). Roll forward by fixing the migration; the next API request will surface the missing column / constraint via Sentry.

This sequencing is acceptable because schema changes are reviewed in PR before merge. For tighter coupling (block deploy on migration failure), upgrade to Phase 2's GitHub-Actions-driven deploy with `environment: production` gates.

## Rollback

| Layer        | How                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel (web) | Deployments → previous green build → "Promote to Production"                                                                            |
| Vercel (api) | Deployments → previous green build → "Promote to Production"                                                                            |
| Database     | Supabase → Project Settings → Database → Backups → Restore. **Pause both Vercel projects first** so writes don't race the restore       |
| Migrations   | Forward-only. If a migration shipped that you can't roll back via image rollback, write a reverse migration as the next merge to `main` |

Database rollback is destructive. Destructive migrations must ship only with a reviewed manual reverse-migration plan and stakeholder sign-off — see Backup Strategy.

## Backup Strategy

Supabase Pro projects ship with automatic daily Postgres backups. Phase 1 should upgrade to Pro the moment real users arrive.

- **Storage**: Supabase-managed; surfaced under Project Settings → Database → Backups.
- **Retention**: 7 days on Pro. Enable PITR (Point-in-Time Recovery) for 7–30 days.
- **RPO / RTO**: RPO ≤ 24h without PITR; RTO is "minutes to a few hours" for Supabase-managed restores.
- **Restore procedure**: pause both Vercel projects → trigger restore in Supabase dashboard → run `prisma migrate status` against the restored DB to confirm migration version → unpause Vercel projects.
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
| Cron job execution      | Vercel Project → Cron Jobs → "Last invocation" + Sentry `novelhub-api`                             |
| Migration outcome       | GitHub Actions → `migrate-on-deploy` workflow runs                                                 |

Sentry's built-in email alert is enough for Phase 1; route both projects to the on-call email. Add Slack/Discord webhook in Phase 2.

## Common Issues

**Stripe webhook 400s** — verify `STRIPE_WEBHOOK_SECRET` matches the live webhook's signing secret (test-mode secrets do **not** validate live events), confirm the endpoint URL is correct, and check that `apps/api/api/[...path].ts` still exports `config.api.bodyParser = false` (Vercel must NOT parse the body or the signature fails).

**Login works locally but fails in production** — confirm `NEXT_PUBLIC_APP_URL`, the API's CORS origin, secure cookie settings, and the production domain on the JWT cookie path. Cross-subdomain cookies (`novelhub.example` ↔ `api.novelhub.example`) need `SameSite=None; Secure` and a parent domain on the cookie.

**Chapter content 403s** — confirm `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`. Chapter objects must remain private; API-generated presigned URLs are valid for 1 hour.

**Cover images do not render** — confirm `R2_PUBLIC_HOST` (backend) and `NEXT_PUBLIC_R2_PUBLIC_HOST` / `NEXT_PUBLIC_IMAGE_HOST` (frontend) all point at the **same** Cloudflare custom domain.

**Facebook events do not deduplicate** — confirm the frontend Pixel and backend CAPI share the same `event_id` per request. The web client generates `event_id` and passes it to both; if the server ignores or regenerates, dedup breaks. Re-check `apps/api/src/modules/fb-capi/`.

**Sentry is quiet** — confirm `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set, and `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT_*` are populated for source-map upload (build-time variables).

**`/health` returns `db: fail`** — Pre-deploy migration probably succeeded but the connection pool is misconfigured. Check `DATABASE_URL` includes `?pgbouncer=true&connection_limit=1` for Supabase, and that the Vercel `novelhub-api` project's runtime env points at the **pooler** (port 6543), not the direct connection.

**Cron didn't run** — Vercel Project → Cron Jobs lists every cron's last invocation time and last response. If `Last invocation` is stale, check that `vercel.json` shipped in the deploy and `CRON_SECRET` is set on both ends. If the cron hits but returns 401, the auth header isn't matching — Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically when the env is set.

**API cold-start exceeds the user's patience** — UptimeRobot's 5-min `/health` probe should keep the function warm in practice. If a user reports a 3-second wait on first page load, check Vercel Logs for "Cold start" markers near that timestamp. Mitigation: upgrade to Vercel Pro (longer warm window), or move the API to Phase 2's container deployment.

## Phase 2 — Deferred

These are intentionally not part of Phase 1. Re-evaluate when the listed condition is met.

| Item                                                  | Trigger to enable                                                         | How                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway / Fly / Render dedicated container host       | Cold-start latency hurts conversions, OR cron task duration > 60s         | `apps/api/Dockerfile` is already production-ready. Switch the API runtime by deploying that Dockerfile; flip `CRON_DRIVER` off so internal scheduler runs |
| Upstash Redis                                         | DAU > 1k or `/books` p95 > 500ms                                          | Provision Upstash → set `REDIS_URL` in `novelhub-api` Vercel env. Code auto-enables cache, no diff                                                        |
| OneSignal Push                                        | First retention campaign / re-engagement push                             | Set `NEXT_PUBLIC_ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY`. Real-device verify the SW scope fix from #46                                               |
| Discord/Slack alerts                                  | Second P1 incident                                                        | Sentry → Alerts → Webhook integration                                                                                                                     |
| Full staging environment                              | Team > 2 people                                                           | Configure `STAGING_*` secrets in GitHub; `staging-deploy.yml` and `staging-healthcheck.yml` already exist                                                 |
| GitHub Actions production deploy with manual approval | Team > 2 people / regulated change-control                                | Disable Vercel auto-deploy; add `production-deploy.yml` with `environment: production` gate that blocks on `migrate-on-deploy` success                    |
| Sentry Performance / Profiling                        | Real performance investigation                                            | Bump `tracesSampleRate` from 0.1 → 1.0; enable profiling SDK                                                                                              |
| Cross-region read replicas                            | Multi-region traffic / GDPR data residency                                | Supabase → Read Replicas                                                                                                                                  |
| Independent worker / queue                            | Cron count > 5, or single-task duration > 1 min, or backpressure observed | BullMQ + Upstash; extract from the NestJS monolith                                                                                                        |
