# Phase 0 — Cloudflare Full Rewrite Migration Audit (Option B)

> **Status:** Phase 0 audit. Read-only. No code changes in this document. The user has confirmed the plan; Task 1 (the Prisma + driver-adapter spike) is the next concrete work.
>
> **Mandate:** Migrate Web → Cloudflare Pages, API → Cloudflare Workers (Hono). Keep Supabase, R2, Stripe, Meta, Sentry, OneSignal, Resend. Drop Vercel + Railway as Phase 1 main paths. Target Phase 1 fixed cost ≈ **$5/mo** (Workers paid plan only).

**Repository state when this audit was written:** `magicxiaomin/novelhub` @ `main` (PR #67 merged 2026-05-08). All 14 tickets + 7 follow-ups + Phase 1 Vercel-only infra merged.

**Open questions resolved at audit confirmation (2026-05-08):**

1. **Workers paid plan ($5/mo)** — chosen, so bcryptjs cost stays at 12 and 50 ms CPU budget is sufficient for `crypto.subtle` work in Stripe webhook signing and bcrypt verification.
2. **DNS layout** — `api.novelhub.com` + `app.novelhub.com` (or apex) + `cdn.novelhub.com`. Same eTLD+1 keeps `sameSite: lax` cookies working unchanged.
3. **bcryptjs cost** — stays at 12 (gated by #1).
4. **Document location** — `docs/cloudflare-migration-phase0.md` (this file).
5. **Local dev** — keep Nest stack running in parallel until Task 12; cut over only when the Cloudflare Worker passes prod smoke.

---

## 0.1 — API Contract Inventory

Authoritative source: `apps/api/src/modules/**/*.controller.ts`. Routes listed in deploy order (auth → catalog → reading → commerce → support → admin → cron). **Auth column:** `JWT` = `JwtAuthGuard` (cookie `jwt=...`, falls back to `Authorization: Bearer`); `OPT` = `OptionalAuthGuard`; `ADMIN` = `JwtAuthGuard + AdminGuard` (`user.isAdmin === true`); `STRIPE` = signature-verified, no JWT; `NONE` = public. All JSON bodies validated by class-validator/class-transformer with `whitelist + forbidNonWhitelisted + transform`.

| #   | Method | Path                                 | Auth                                      | Throttle                          | Notes / side-effects                                                                                                                                                                                                                                            |
| --- | ------ | ------------------------------------ | ----------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GET    | `/health`                            | NONE                                      | skip                              | `SELECT 1` round-trip → `{app, status, db, uptimeSeconds, timestamp}`                                                                                                                                                                                           |
| 2   | POST   | `/auth/register`                     | NONE                                      | 5/min                             | bcryptjs hash; tx insert User + CoinTransaction(+20); sets cookies `jwt`, `jwt_refresh`; fires Resend welcome + FB CAPI `CompleteRegistration` (when consent)                                                                                                   |
| 3   | POST   | `/auth/login`                        | NONE                                      | 60/min                            | bcryptjs compare; checks active sub; sets cookies                                                                                                                                                                                                               |
| 4   | POST   | `/auth/google`                       | NONE                                      | 60/min                            | `google-auth-library.OAuth2Client.verifyIdToken`; create-or-link by `googleId`/`email`; CAPI `CompleteRegistration` for new                                                                                                                                     |
| 5   | POST   | `/auth/refresh`                      | cookie `jwt_refresh`                      | 60/min                            | `JwtService.verifyAsync` against `JWT_REFRESH_SECRET`; rotates cookies                                                                                                                                                                                          |
| 6   | POST   | `/auth/logout`                       | NONE                                      | 60/min                            | clears cookies                                                                                                                                                                                                                                                  |
| 7   | DELETE | `/auth/account`                      | JWT                                       | 5/min                             | password re-confirm; cancels active Stripe subs; soft-delete user                                                                                                                                                                                               |
| 8   | GET    | `/auth/me`                           | JWT                                       | 60/min                            | returns `AuthUser` with `coinBalance` + `hasActiveSubscription`                                                                                                                                                                                                 |
| 9   | POST   | `/auth/forgot-password`              | NONE                                      | 60/min                            | silent on missing user; emits reset-token email; **must not reveal** existence                                                                                                                                                                                  |
| 10  | POST   | `/auth/reset-password`               | reset-token in body                       | 60/min                            | verifies reset JWT; updates `passwordHash`                                                                                                                                                                                                                      |
| 11  | GET    | `/books`                             | NONE                                      | 60/min                            | paginated; uses CACHE_CLIENT (key includes filters)                                                                                                                                                                                                             |
| 12  | GET    | `/books/featured`                    | NONE                                      | 60/min                            | top 10 featured; cached                                                                                                                                                                                                                                         |
| 13  | GET    | `/books/trending`                    | NONE                                      | 60/min                            | top 20 by `createdAt`; cached                                                                                                                                                                                                                                   |
| 14  | GET    | `/books/categories`                  | NONE                                      | 60/min                            | `groupBy(category)`; cached                                                                                                                                                                                                                                     |
| 15  | GET    | `/books/search?q=…`                  | NONE                                      | 60/min                            | case-insensitive contains on title/author                                                                                                                                                                                                                       |
| 16  | GET    | `/books/:id`                         | NONE                                      | 60/min                            | UUIDv4 strict; first 10 chapters inline                                                                                                                                                                                                                         |
| 17  | GET    | `/books/:id/chapters`                | NONE                                      | 60/min                            | paginated chapter summaries                                                                                                                                                                                                                                     |
| 18  | GET    | `/chapters/:id`                      | OPT                                       | 60/min                            | branches **unlocked → signed R2 URL** vs **locked → preview + unlock options**                                                                                                                                                                                  |
| 19  | GET    | `/coins/balance`                     | JWT                                       | 60/min                            | balance lookup                                                                                                                                                                                                                                                  |
| 20  | GET    | `/coins/transactions`                | JWT                                       | 60/min                            | paginated audit list                                                                                                                                                                                                                                            |
| 21  | POST   | `/unlocks/chapter/:chapterId`        | JWT                                       | 60/min                            | tx: spend coins (`updateMany WHERE coinBalance ≥ cost`) + insert `chapter_unlocks`; idempotent (unique `userId_chapterId`)                                                                                                                                      |
| 22  | GET    | `/unlocks?bookId=&page=&limit=`      | JWT                                       | 60/min                            | optional `bookId` UUIDv4 scope                                                                                                                                                                                                                                  |
| 23  | POST   | `/reading-progress`                  | JWT                                       | 30/min                            | `userCanRead()` access guard; upsert by `(userId, chapterId)`                                                                                                                                                                                                   |
| 24  | GET    | `/reading-progress?bookId/chapterId` | JWT                                       | 60/min                            | single row when keyed; otherwise top-10 Continue-Reading list                                                                                                                                                                                                   |
| 25  | GET    | `/checkin/status`                    | JWT                                       | 60/min                            | returns streak status                                                                                                                                                                                                                                           |
| 26  | POST   | `/checkin`                           | JWT                                       | 5/min                             | tx: insert daily checkin (unique `(userId, checkinDate)`) + grant coins via `CoinsService.adjustBalance`                                                                                                                                                        |
| 27  | POST   | `/payments/checkout/coins`           | JWT                                       | 60/min                            | Stripe Checkout `mode: payment`; pre-creates pending Order; CAPI metadata captured                                                                                                                                                                              |
| 28  | POST   | `/payments/checkout/subscription`    | JWT                                       | 60/min                            | Stripe Checkout `mode: subscription`; uses `STRIPE_PRICE_WEEKLY/MONTHLY`                                                                                                                                                                                        |
| 29  | GET    | `/payments/portal`                   | JWT                                       | 60/min                            | Stripe Billing Portal session                                                                                                                                                                                                                                   |
| 30  | GET    | `/payments/subscription`             | JWT                                       | 60/min                            | active subscription summary or null                                                                                                                                                                                                                             |
| 31  | GET    | `/payments/orders/:sessionId`        | JWT                                       | 60/min                            | poll for success page; UUID **not** enforced (Stripe session id format `cs_test_…`)                                                                                                                                                                             |
| 32  | POST   | `/payments/webhook`                  | STRIPE                                    | skip                              | **raw body**, signature via `stripe.webhooks.constructEvent`; `WebhookEvent.stripeEventId` idempotency gate; handlers: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`, `charge.refunded` |
| 33  | POST   | `/notifications/grant-bonus`         | JWT                                       | 5/min                             | OneSignal subscription check; tx-grant 10 coins; partial unique idx `coin_transactions_push_reward_user_idx` enforces one-per-user                                                                                                                              |
| 34  | POST   | `/admin/push/broadcast`              | ADMIN                                     | 5/min                             | OneSignal segment broadcast                                                                                                                                                                                                                                     |
| 35  | POST   | `/support/contact`                   | NONE                                      | 5/min + per-email 3/24h via CACHE | strips CR/LF on header-bound fields                                                                                                                                                                                                                             |
| 36  | GET    | `/admin/dashboard/summary`           | ADMIN                                     | 60/min                            | today/weekly/topBooks                                                                                                                                                                                                                                           |
| 37  | GET    | `/admin/books`                       | ADMIN                                     | 60/min                            | paginated, search                                                                                                                                                                                                                                               |
| 38  | GET    | `/admin/books/:id`                   | ADMIN                                     | 60/min                            | full book                                                                                                                                                                                                                                                       |
| 39  | POST   | `/admin/books`                       | ADMIN                                     | 60/min                            | enforces `coverImageKey ~ ^covers/<uuidv4>$`                                                                                                                                                                                                                    |
| 40  | PUT    | `/admin/books/:id`                   | ADMIN                                     | 60/min                            | derives `coverUrl` from `R2_PUBLIC_HOST` if cover key supplied without explicit URL                                                                                                                                                                             |
| 41  | DELETE | `/admin/books/:id`                   | ADMIN                                     | 60/min                            | soft-delete                                                                                                                                                                                                                                                     |
| 42  | POST   | `/admin/books/:id/chapters`          | ADMIN                                     | 60/min                            | **multipart/form-data** via `@nestjs/platform-express` `FileInterceptor` (multer); 10 MB cap; splits by `\n\n---\n\n` delimiter                                                                                                                                 |
| 43  | POST   | `/admin/books/:id/chapters/bulk`     | ADMIN cookie-gate + ADMIN                 | 60/min                            | wider 10MB JSON parser mounted at `main.ts`; per-chapter content ≤ 200 KB                                                                                                                                                                                       |
| 44  | GET    | `/admin/chapters`                    | ADMIN                                     | 60/min                            | paginated; optional `bookId`                                                                                                                                                                                                                                    |
| 45  | GET    | `/admin/chapters/:id`                | ADMIN                                     | 60/min                            | reads R2 content                                                                                                                                                                                                                                                |
| 46  | PUT    | `/admin/chapters/:id`                | ADMIN                                     | 60/min                            | rewrites R2 + warms preview cache                                                                                                                                                                                                                               |
| 47  | DELETE | `/admin/chapters/:id`                | ADMIN                                     | 60/min                            | soft-delete + cache invalidate                                                                                                                                                                                                                                  |
| 48  | GET    | `/admin/users`                       | ADMIN                                     | 60/min                            | paginated search                                                                                                                                                                                                                                                |
| 49  | GET    | `/admin/users/:id`                   | ADMIN                                     | 60/min                            | detail                                                                                                                                                                                                                                                          |
| 50  | POST   | `/admin/users/:id/ban`               | ADMIN                                     | 60/min                            | sets `bannedAt`                                                                                                                                                                                                                                                 |
| 51  | POST   | `/admin/users/:id/unban`             | ADMIN                                     | 60/min                            | clears `bannedAt`                                                                                                                                                                                                                                               |
| 52  | GET    | `/admin/orders`                      | ADMIN                                     | 60/min                            | paginated                                                                                                                                                                                                                                                       |
| 53  | POST   | `/admin/uploads/cover-url`           | ADMIN                                     | 60/min                            | issues presigned PUT to R2 (`covers/<uuidv4>`) for ALLOWED_COVER_MIME                                                                                                                                                                                           |
| C1  | (cron) | `re-engagement` `0 */6 * * *`        | shared-secret today, none after migration | n/a                               | Postgres advisory `pg_try_advisory_xact_lock(12001)`; reads `ReadingProgress` lower=−30h upper=−24h; OneSignal pushes                                                                                                                                           |
| C2  | (cron) | `renewal-reminders` `0 9 * * *`      | shared-secret today, none after migration | n/a                               | advisory lock 12002; `Subscription` ending in 3-4 days, `cancelAtPeriodEnd=false`                                                                                                                                                                               |

**Vercel-specific glue that disappears post-Cloudflare:**

- `apps/api/api/[...path].ts` — Express adapter wrapping NestApplication
- `apps/api/api/cron/{re-engagement,renewal-reminders}.ts` — Vercel Cron HTTP handlers with `CRON_SECRET` bearer
- `apps/api/vercel.json` — function memory/timeout, cron schedules, `/((?!api/).*)` rewrite
- `.github/workflows/migrate-on-deploy.yml` — runs `prisma migrate deploy` against `PRODUCTION_DATABASE_URL` on push to main (will be retargeted at the Supabase direct port 5432 URL — see Task 11)

---

## 0.2 — 13 Business Critical Chains

Each chain must remain identical end-to-end after migration. **Behavior parity is a hard gate** — no schema, status code, or cookie semantics change.

1. **Anonymous browse** — `/books`, `/books/featured|trending|categories`, `/books/:id`, `/chapters/:id` (free chapter only). No auth, no cookies, cacheable. SSR via `apps/web/src/lib/server-api.ts`.
2. **Email/password registration** — `POST /auth/register` → 201 + `Set-Cookie: jwt; jwt_refresh` + 20 signup coins + `coin_transactions` row + Resend welcome + (if consent) CAPI `CompleteRegistration`.
3. **Google OAuth** — `POST /auth/google` with id_token → verifyIdToken → create-or-link user (3 branches: existing-by-google, existing-by-email, new) → cookies + CAPI for new only.
4. **Session refresh** — browser hits `/auth/me`; 401 → silent `POST /auth/refresh` (cookie-only) → retry. `JwtService.verifyAsync` against refresh secret, must reject `type !== 'refresh'`.
5. **Password reset** — `POST /auth/forgot-password` (silent on missing) → reset JWT (1h, HS256) → email link `${NEXT_PUBLIC_APP_URL}/reset-password?token=…` → `POST /auth/reset-password` rehashes via bcryptjs (cost 12).
6. **Free chapter read** — `GET /chapters/:id` with optional auth → `isFree=true` short-circuit → returns signed R2 GET URL (1h TTL) + prev/next chapter ids.
7. **Locked chapter unlock by coins** — `GET /chapters/:id` (locked envelope: preview from cache, unlock options) → `POST /unlocks/chapter/:chapterId` → tx: `coins.adjustBalance(-cost)` → `chapter_unlocks` insert (unique key prevents double-unlock) → re-read returns unlocked envelope. Idempotent on retry.
8. **Subscription unlock** — active sub (status ∈ {active, past_due, canceled} **AND** `currentPeriodEnd > now`) bypasses the unlock table entirely; `chapters.service.ts:isUnlockedFor` checks subscription before unlock row.
9. **Coin checkout** — `POST /payments/checkout/coins` → Stripe Session created with `mode: payment`, `metadata.userId|orderType|packageId`, `customer` reused if cached → pending Order pre-created → 201 `{url, sessionId}` → browser redirects → Stripe → `checkout.session.completed` webhook → tx flip Order PENDING→COMPLETED + `coins.adjustBalance(+pkg.coins)` + AFTER-COMMIT publisher fires CAPI `Purchase`.
10. **Subscription checkout** — same flow with `mode: subscription`; subscription state owned by `customer.subscription.{created,updated,deleted}` (NOT by checkout.session.completed); `subscription_data.metadata.userId` carries identity.
11. **Refund** — `charge.refunded` → look up order by `stripePaymentIntent` → tx flip COMPLETED→REFUNDED + `coins.adjustBalance(-coinsGranted)` for COIN_PURCHASE only.
12. **Payment-success polling** — `/payment/success` page polls `GET /payments/orders/:sessionId` until `status==='completed'`.
13. **Daily check-in** — `GET /checkin/status` → `POST /checkin` (5/min) → `daily_checkins` insert (unique `(userId, checkinDate)`) + coin grant. Race-safe via unique constraint.

Plus 4 background flows:

- **Re-engagement push** — cron @6h: users whose latest `ReadingProgress.lastReadAt` is 24-30h old (no newer activity) get OneSignal push.
- **Renewal reminder push** — cron @09:00 UTC: subscriptions ending in 3-4d with `cancelAtPeriodEnd=false`.
- **Push permission bonus** — `POST /notifications/grant-bonus` (one per user lifetime, partial unique index).
- **Admin chapter import** — multipart upload OR JSON bulk-create → R2 PUT (`chapters/<bookId>/<chapterUuid>.txt`) → Chapter rows + book.totalChapters increment + cache warm.

---

## 0.3 — Workers API Target Tech Stack

| Concern          | Today (Node)                                       | Workers (target)                                                                                          | Reason                                                                                                                        |
| ---------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| HTTP framework   | NestJS 10 + `@nestjs/platform-express`             | **Hono** + `@hono/zod-validator`                                                                          | Workers V8 isolates have no Node `http.Server`; Hono is the de-facto Workers framework with zero-boot overhead                |
| Validation       | class-validator/class-transformer                  | **Zod** schemas                                                                                           | class-validator depends on `reflect-metadata` + decorators; Zod is parse-once and TypeScript-first, lighter on bundle and CPU |
| Auth (JWT)       | `@nestjs/jwt` + `passport-jwt` (HS256)             | **`jose`**                                                                                                | passport's `req.user` middleware model doesn't fit Hono; `jose` is pure ES modules, supports HS256                            |
| OAuth            | `google-auth-library@9`                            | **`jose.createRemoteJWKSet` + `jose.jwtVerify`** against Google's JWKS                                    | Smaller, no Node deps, ~30 lines                                                                                              |
| Password hashing | `bcryptjs` cost=12                                 | **`bcryptjs`** (unchanged)                                                                                | Pure-JS, Workers-compatible. Cost 12 ≈ 80–150 ms; fits within paid Workers' 50 ms CPU when amortised                          |
| DB driver        | `@prisma/client` (binary engine via Node libuv)    | **`@prisma/client` + driver adapter `@prisma/adapter-pg-worker`**                                         | Prisma 6.6 supports Workers driver-adapter mode. Combined with **Cloudflare Hyperdrive** for connection multiplexing          |
| Stripe SDK       | `stripe@17` `webhooks.constructEvent` (sync)       | `stripe@17` `webhooks.constructEventAsync`                                                                | Async variant uses `crypto.subtle` available on Workers                                                                       |
| R2               | `@aws-sdk/client-s3` + `s3-request-presigner`      | **R2 binding** (`env.BUCKET.put/get`) for puts/gets, **`aws4fetch`** for presigned URLs                   | Zero Worker→R2 egress; aws4fetch ≈8 KB tested for R2 SigV4                                                                    |
| Cache (Redis)    | `ioredis` (TCP)                                    | **Cloudflare KV** for support rate-limit only (book/preview cache stays no-op for Phase 1)                | Workers can't open arbitrary TCP; Upstash REST adds paid dep                                                                  |
| Email            | `resend@4`                                         | `resend@4` (uses fetch)                                                                                   | Already fetch-based                                                                                                           |
| Push             | `OneSignalClient` (fetch + AbortSignal.timeout)    | **unchanged**                                                                                             | Already Workers-shaped                                                                                                        |
| Sentry           | `@sentry/node@10`                                  | **`@sentry/cloudflare`**                                                                                  | Workers-native isolation scope per request                                                                                    |
| Cron             | `@nestjs/schedule` (in-process) + Vercel Cron HTTP | **Cloudflare Cron Triggers** in `wrangler.toml`, single `scheduled()` handler dispatching by `event.cron` | Native; no shared-secret needed                                                                                               |
| Multipart upload | `multer` (`FileInterceptor`)                       | **Hono `c.req.formData()`** + `file.arrayBuffer()`                                                        | Rebuilds existing 10 MB cap server-side on Worker                                                                             |
| Static assets    | `app.useStaticAssets` (dev only)                   | dropped — never shipped to prod                                                                           | Dev-only seed assets stay for `pnpm dev`                                                                                      |
| Build/deploy     | `nest build` → `node dist/main.js`                 | `wrangler deploy` (esbuild); `wrangler.toml` per env                                                      | Standard Workers CI                                                                                                           |
| Local dev        | `nest start --watch`                               | `wrangler dev` (miniflare)                                                                                | Identical UX                                                                                                                  |

**New runtime layout:** single Worker at `apps/api/src/worker.ts` with bindings: `BUCKET` (R2), `KV` (Cloudflare KV for support rate-limit), `HYPERDRIVE` (Hyperdrive linked to Supabase Postgres direct port 5432), and env secrets for everything else.

---

## 0.4 — Database / Prisma Strategy

Schema (`packages/db/prisma/schema.prisma`) **stays exactly as-is** — 9 models, 1 partial unique index, 1 advisory-lock-based cron leader election. No model rename, no field rename.

**Decisions for the 13 questions:**

1. **Prisma engine on Workers?** `@prisma/client` v6.6 (already pinned) with `previewFeatures = ["driverAdapters"]` and `@prisma/adapter-pg-worker`. Rust query engine replaced by direct SQL through the adapter — supported and stable on 6.6.
2. **Connection pool?** **Cloudflare Hyperdrive** binding pointing at Supabase Postgres direct port 5432. Hyperdrive does the pooling and TLS to Supabase. **Not** pgbouncer 6543 — Hyperdrive handles pooling itself; double-pooling breaks prepared statements.
3. **Where do migrations run?** GitHub Actions on push-to-main, via `prisma migrate deploy` against `PRODUCTION_DATABASE_URL_DIRECT` (Supabase direct port 5432, **not** Hyperdrive — Hyperdrive can't run DDL). Replace `migrate-on-deploy.yml` to point at the new direct URL secret.
4. **Advisory locks (`pg_try_advisory_xact_lock`)?** Work fine through Hyperdrive — they're a session/transaction primitive evaluated server-side. The existing `withCronLock` helper works unchanged.
5. **Transactions?** `prisma.$transaction(async tx => …)` is supported. Verify all 7 transaction-bearing call sites still pass tests:
   - `auth.service.ts` (register, googleLogin)
   - `coins.service.ts` (adjustBalance — only opens a tx if caller didn't pass one)
   - `webhook.service.ts` (`completeCoinOrder`, `onChargeRefunded`)
   - `notifications.service.ts` (`grantBonus` — Serializable isolation)
   - `admin.service.ts` (`bulkCreateChapters`)
   - `checkin.service.ts` (claim)
6. **Serializable isolation level (`grantBonus`)?** Driver adapter supports passing `{ isolationLevel }` — Task 1 spike validates.
7. **`$queryRaw` for health check?** Supported.
8. **Prisma seed?** `packages/db/prisma/seed.mjs` runs in Node (CI / one-off), not on Workers. Unchanged.
9. **prisma generate?** Runs at GitHub Actions time AND at `wrangler deploy` time (the Worker bundles `@prisma/client`). Add to `wrangler.toml` build command.
10. **Connection limits?** Supabase free tier: 60 direct connections. Hyperdrive multiplexes — fits comfortably.
11. **Cold-start prepared statement caching?** Hyperdrive caches per-connection at the edge.
12. **Read replicas?** Not configured today. Not required Phase 1.
13. **JSON columns?** `Order.metadata`, `FbEvent.payload` — both work through driver adapter (`Prisma.InputJsonValue`).

**Driver adapter switch (illustrative; Task 4 actually does this):**

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg-worker';
import { Pool } from '@prisma/pg-worker';

export function makePrisma(env: { HYPERDRIVE: Hyperdrive }): PrismaClient {
  const pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
```

---

## 0.5 — Auth Migration (Passport → jose + Hono middleware)

**Replace:**

- `passport-jwt` strategy + `JwtStrategy.validate` → Hono middleware that:
  1. Reads cookie `jwt` via `hono/cookie`'s `getCookie`; falls back to `Authorization: Bearer`.
  2. `jose.jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), { algorithms: ['HS256'] })`.
  3. Asserts `payload.type === 'access'` and `payload.sub`.
  4. `prisma.user.findUnique({ where: { id: payload.sub }, select: { id, email, isAdmin, deletedAt, bannedAt } })`; rejects if soft-deleted/banned.
  5. Sets `c.set('user', { id, email, isAdmin })` for downstream handlers.
- `JwtAuthGuard` → middleware that 401s on missing user.
- `OptionalAuthGuard` → middleware that swallows verification errors.
- `AdminGuard` → middleware requiring `c.get('user').isAdmin === true`.
- `JwtService.signAsync` → `new jose.SignJWT(payload).setExpirationTime('24h').sign(key)`.
- `JwtService.verifyAsync` → `jose.jwtVerify`.
- `cookie-parser` → `hono/cookie` `getCookie`/`setCookie`.
- `bcryptjs.hash`/`compare` → unchanged.
- Google OAuth — replace `google-auth-library.OAuth2Client.verifyIdToken` with `jose.jwtVerify` against `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))`, asserting `aud === GOOGLE_CLIENT_ID`, `iss ∈ {accounts.google.com, https://accounts.google.com}`, `email_verified === true`.

**Cookie parity gates** (cannot regress):

- `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`.
- Names exactly `jwt` and `jwt_refresh`.
- Max-Age: access 24 h, refresh 30 d, reset 1 h.

**Cross-domain plan:** Web on `app.novelhub.com`, API on `api.novelhub.com` — same eTLD+1 means `sameSite: lax` works. **Pre-launch DNS plan keeps both under one apex domain.** If splitting becomes necessary, switch cookie config to `sameSite: 'none'; secure: true; domain: '.novelhub.com'`.

---

## 0.6 — Stripe Migration

**3 changes:**

1. **`webhook.service.ts:427`** — `this.stripe.get().webhooks.constructEvent(rawBody, signature, secret)` → `await this.stripe.get().webhooks.constructEventAsync(rawBody, signature, secret)`. Async variant uses `crypto.subtle.timingSafeEqual` available on Workers. **All 7 webhook event types keep identical payload handling.**
2. **Raw body access.** Today: `RawBodyRequest<Request>` (Express `rawBody:true`). On Hono: `const rawBody = new Uint8Array(await c.req.arrayBuffer())`.
3. **Stripe SDK initialization** stays lazy via `LazyStripe`; SDK 17 detects fetch on Workers and uses it instead of Node http.

**No changes to:**

- 4-layer idempotency (`WebhookEvent.stripeEventId @unique` insert-first, `WHERE status='pending'` predicate on coin grant updateMany, `upsert` on subscription, `WHERE status='completed'` gate on refund)
- After-commit `purchasePublisher.publish` for CAPI `Purchase`
- Stripe API version pin: `2025-02-24.acacia`
- `stripe-signature` header read

**Webhook URL in Stripe Dashboard** changes from `https://novelhub-api.vercel.app/api/payments/webhook` → `https://api.novelhub.com/payments/webhook`. New `whsec_…` signing secret rotated into Worker secret store.

---

## 0.7 — R2 Strategy

**Two access patterns:**

1. **Covers (public read):** Bucket connected to Cloudflare custom domain `cdn.novelhub.com` with public read. `R2_PUBLIC_HOST=cdn.novelhub.com`. `coverUrl = https://${R2_PUBLIC_HOST}/${coverImageKey}`. Browser fetches directly — no Worker hop, free egress.
2. **Chapter content (private read, signed):** Stored under `chapters/<bookId>/<chapterUuid>.txt`. `chapters.service.ts:signContent` issues 1 h signed URLs. Browser fetches signed URL directly.

**SDK swap:**

- Drop `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (~6 MB).
- For PUTs/GETs from the Worker: **R2 binding** `env.BUCKET.put(key, body)`, `env.BUCKET.get(key).text()`. Zero-egress, no signature work.
- For browser-issued presigned PUT/GET URLs: **`aws4fetch`** (~8 KB) producing SigV4 URLs against `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>?X-Amz-…`.

**Signed URL TTL** unchanged at 3600 s (`SIGNED_URL_TTL_SECONDS`).

**StorageClient interface** — keep the 4-method contract (`uploadText`, `getSignedUrl`, `getSignedUploadUrl`, `getText`). Ship two implementations: `R2WorkerClient` (binding) for runtime, `R2HttpClient` (aws4fetch) for local-dev fallback when no binding is present.

---

## 0.8 — Admin Upload (Replace multer)

`admin.controller.ts:89` uses `@nestjs/platform-express`'s `FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })`.

**Recommendation: server-side parsing on Worker (drop-in replacement):**

- Hono: `const formData = await c.req.formData(); const file = formData.get('file');`
- File limit: `if (file.size > MAX_UPLOAD_BYTES) throw 413`.
- File body: `const buffer = await file.arrayBuffer()`.
- Pass to `admin.service.ts:bulkImportChapters(bookId, Buffer.from(buffer), options)` — same contract.

Pros: zero frontend changes; security model unchanged (admin guard fires before parsing).

Cons: 10 MB body burns Worker CPU briefly during the `\n\n---\n\n` split. Workers paid plan: 30 ms CPU per request, 5 sec for cron — should fit; verify in Task 9.

---

## 0.9 — Cron Migration

**Drop:** `@nestjs/schedule` + Vercel Cron HTTP triggers + `apps/api/api/cron/*.ts`.

**Adopt:** Cloudflare Cron Triggers in `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 */6 * * *",   # re-engagement
  "0 9 * * *",     # renewal-reminders
]
```

Single `scheduled(event, env, ctx)` handler dispatches by `event.cron` string:

```ts
async scheduled(event, env, ctx) {
  ctx.waitUntil((async () => {
    const prisma = makePrisma(env);
    if (event.cron === '0 */6 * * *') {
      await withCronLock(prisma, 12001, () => sendReEngagement(prisma, env));
    } else if (event.cron === '0 9 * * *') {
      await withCronLock(prisma, 12002, () => sendRenewalReminders(prisma, env));
    }
  })());
}
```

**Auth:** No `CRON_SECRET` needed — `scheduled` is invoked by Cloudflare itself, not over public HTTP. The `apps/api/api/cron/*.ts` shared-bearer pattern goes away.

**Why advisory locks still matter:** During a deployment rollover both old and new Workers can briefly receive the same cron tick. The existing `pg_try_advisory_xact_lock` already protects this — keep it.

**Local dev parity:** `wrangler dev --test-scheduled` exposes a `__scheduled` curl endpoint to fire crons manually. Document in runbook.

---

## 0.10 — Meta Pixel / CAPI

**Approximately one node-only import to swap:** `import { createHash } from 'node:crypto'` → Web Crypto:

```ts
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
```

`hashEmail` becomes async — propagate await through `buildPayload`. **Verify the existing 7-event taxonomy** still fires:

1. `PageView` (web pixel only)
2. `ViewContent` (web pixel only)
3. `AddToCart` (web pixel only)
4. `InitiateCheckout` (web pixel only)
5. `Purchase` (CAPI from `WebhookService.completeCoinOrder` after-commit)
6. `CompleteRegistration` (CAPI from `AuthService.register/loginWithGoogle`)
7. `Subscribe` (CAPI from `WebhookService.onCheckoutCompleted` for SUBSCRIPTION)

**`req.ip` extraction:** Express `req.ip` (with `trust proxy: 1`) → Hono `c.req.header('CF-Connecting-IP')` (Cloudflare guarantees this header is present and unspoofable).

**`_fbp` / `_fbc` cookies** read via Hono's `getCookie`.

---

## 0.11 — Sentry Migration

**API:** `@sentry/node@10` → `@sentry/cloudflare`. Replace:

- `apps/api/src/instrument.ts` — drop. `@sentry/cloudflare` initialised inline in the Worker `fetch` handler.
- `SentryExceptionFilter` — drop (Hono catches via `app.onError`); replace with:

  ```ts
  app.onError((err, c) => {
    if (env.SENTRY_DSN && (!(err instanceof HTTPException) || err.status >= 500)) {
      Sentry.captureException(err);
    }
    return c.json({ message: err.message }, err instanceof HTTPException ? err.status : 500);
  });
  ```

- `SentryUserInterceptor` — replaced by Hono middleware that calls `Sentry.getIsolationScope().setUser(...)` after auth resolves. `@sentry/cloudflare` already creates per-request isolation scopes.

**Web:** Cloudflare Pages with Next.js — `@sentry/nextjs` already configured. Pages supports `@sentry/nextjs` with `@cloudflare/next-on-pages`. Verify edge-runtime SSR + Sentry edge config in Task 14.

**Source maps:** keep `SENTRY_AUTH_TOKEN` build-time. For the Worker, add `wrangler.toml` `upload_source_maps = true`.

---

## 0.12 — Web on Cloudflare Pages

**Build adapter:** `@cloudflare/next-on-pages` (stable, official).

**Steps for Task 14:**

1. `pnpm --filter @novelhub/web add -D @cloudflare/next-on-pages` and `vercel` (next-on-pages needs Vercel build output).
2. Pages build command: `pnpm --filter @novelhub/shared build && pnpm --filter @novelhub/web exec next-on-pages`. Output: `.vercel/output/static`.
3. Pages compatibility flag: `nodejs_compat`.
4. Service worker (`next-pwa`) generated to `apps/web/public/sw.js` — Pages serves from `/sw.js`, no change.
5. OneSignal SW lives at `/onesignal/OneSignalSDKWorker.js` with scope `/onesignal/` (PR #58) — works on Pages.
6. **Drop `@vercel/analytics`** — Vercel-only.
7. Image loader: set `images.unoptimized: true` for Phase 1 (covers ~50 KB R2-stored). Cloudflare Images optimisation is a Phase 2 paid upgrade.
8. RSC fetch (`server-api.ts`) → uses `process.env.NEXT_PUBLIC_API_URL`; on Pages becomes `https://api.novelhub.com`.
9. `output: 'standalone'` in `next.config.mjs` is **incompatible** with `next-on-pages`. Drop — it was Railway-era leftover.

---

## 0.13 — Deployment / CI/CD

**New repo layout (additions only):**

```text
apps/api/
  src/
    worker.ts               # Hono app + scheduled handler
    middleware/             # auth, optional-auth, admin-guard
    routes/                 # 13 route modules
    db/                     # prisma client factory using HYPERDRIVE binding
  wrangler.toml             # bindings + crons + envs (production, staging)
  package.json              # drops @nestjs/*, multer, ioredis, passport*, @sentry/node
                            # adds hono, @hono/zod-validator, jose, zod,
                            # @prisma/adapter-pg-worker, aws4fetch,
                            # @sentry/cloudflare, wrangler
apps/web/
  next.config.mjs           # drops output:'standalone', images.unoptimized:true
  package.json              # drops @vercel/analytics
                            # adds @cloudflare/next-on-pages, vercel (build dep)
.github/workflows/
  migrate-on-deploy.yml     # tweak: PRODUCTION_DATABASE_URL → DIRECT URL
  deploy-api.yml (new)      # `wrangler deploy` on push to main
```

**Files to delete in Task 16:** `apps/api/Dockerfile`, `apps/api/api/[...path].ts`, `apps/api/api/cron/*.ts`, `apps/api/vercel.json`, `apps/api/src/main.ts`, `apps/api/src/instrument.ts`, every `*.module.ts`, every NestJS controller, every `*.guard.ts`/`*.interceptor.ts`/`*.filter.ts`, every Passport strategy.

**Files to keep verbatim:**

- All `*.service.ts` (business logic) — strip `@Injectable()` + DI ctor; pass deps explicitly through factory. **This preserves the test suite (193 backend tests) intact** — only constructors get rewired.
- `apps/api/src/modules/payments/webhook.service.ts` — keep, but `constructEvent` → `constructEventAsync`.
- `apps/api/src/modules/notifications/cron/leader-election.ts` — verbatim.
- `apps/api/src/modules/notifications/one-signal.client.ts` — verbatim (already fetch+timeout).
- All DTOs — translate from class-validator decorators to Zod schemas. Mechanical, ~30 files.
- `packages/shared/**`, `packages/db/prisma/**` — verbatim.

**Secrets (Cloudflare):**

- API Worker (`wrangler secret put`): `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_RESET_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_MONTHLY`, `R2_PUBLIC_HOST`, `FB_CAPI_ACCESS_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `SUPPORT_FROM_EMAIL`, `ONESIGNAL_REST_API_KEY`, `NEXT_PUBLIC_FB_PIXEL_ID`, `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `NEXT_PUBLIC_APP_URL`, `SENTRY_DSN`.
- API Worker bindings (in `wrangler.toml`): `BUCKET = novelhub-content` (R2), `KV` (support rate-limit), `HYPERDRIVE` (linked to Supabase direct URL).
- Pages project: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_FB_PIXEL_ID`, `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `NEXT_PUBLIC_R2_PUBLIC_HOST`, `NEXT_PUBLIC_IMAGE_HOST`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_DMCA_EMAIL`, build-time `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_WEB`.
- GitHub repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PRODUCTION_DATABASE_URL_DIRECT` (Supabase port 5432).

**Migrations:** `migrate-on-deploy.yml` swaps `PRODUCTION_DATABASE_URL` for `PRODUCTION_DATABASE_URL_DIRECT`. **Critical:** never run migrations through Hyperdrive — Hyperdrive proxies queries with prepared-statement caching that breaks DDL.

**DNS:**

- `api.novelhub.com` → Worker route in `wrangler.toml` (`routes = [{ pattern = "api.novelhub.com/*", custom_domain = true }]`).
- `app.novelhub.com` → Pages custom domain.
- `cdn.novelhub.com` → R2 public bucket.

---

## 0.14 — Risk List

### P0 (release-blockers — must resolve before code work)

1. **Prisma + Hyperdrive + driver adapter compatibility** (engine, isolation levels, `$queryRaw`, advisory locks, JSON columns). Verification: **Task 1 spike**. If any of the 4 sub-checks fail, abort and revisit Options A/C.
2. **bcryptjs cost-12 within Workers CPU budget.** Mitigated by paid Workers plan (50 ms CPU). Verify cost-12 hash + verify together stay under 50 ms in spike.
3. **Stripe `constructEventAsync` parity.** Verify webhook signature verification under Workers `crypto.subtle` exactly matches today's behavior across all 7 event types. Stripe ships official Workers samples — follow them.
4. **Multipart upload on Workers.** Verify Hono's `c.req.formData()` handles 10 MB files within Worker request size + CPU limits in Task 9.
5. **Cookie cross-domain.** Plan for `api.novelhub.com` + `app.novelhub.com` (same eTLD+1) before DNS provisioning. Confirmed.

### P1 (test-it-first risks)

6. **Web RSC + Edge runtime + Sentry on Pages.** `@sentry/nextjs` works on Pages but the edge runtime has constraints; verify in Task 14.
7. **Image loader on Pages.** Decision: `unoptimized: true` for Phase 1; cosmetic.
8. **`@vercel/analytics` removal.** Spot-check `app/layout.tsx` for hard imports.
9. **Hono auth middleware behavioral parity.** All 50+ JWT tests in `auth.service.spec.ts` must pass — including soft-deleted/banned user gate.
10. **`@nestjs/schedule` removal vs `pg_try_advisory_xact_lock` semantics.** Cloudflare's `scheduled` may fire on multiple isolates during deploys; advisory locks must guard. Verify in Task 8.
11. **Resend / Google OAuth / OneSignal HTTP fetches** — already fetch-based; verify `AbortSignal.timeout()` is supported (it is, Workers compat date 2023-12-22+).
12. **CAPI hash function async-ification** — `hashEmail` becomes async; ripple through `buildPayload`. Mechanical.
13. **R2 SDK swap** — `aws4fetch` SigV4 against R2 must match `@aws-sdk/s3-request-presigner` signed URL format (it does in tests, but verify our specific TTL + content-type signing).

### P2 (operational, non-blocking)

14. **Sentry source-map upload from Wrangler build pipeline** — verify post-migration, drift-tolerable.
15. **DNS cutover plan** — staging on a sub-domain first, swap to apex via DNS only after smoke. Document in runbook.
16. **Stripe webhook URL rotation** — coordinate; signing secret changes; brief webhook-blackout during cutover (Stripe will retry).
17. **Pages preview environments** — automatic on PRs; verify env vars are scoped per env.
18. **OneSignal Web Push registration** — SW served from Pages at `/onesignal/`.
19. **Admin route browser cookie** — admin UI sets the same `jwt` cookie; cross-domain rules apply.

---

## 0.15 — Codex Task Breakdown

**Workflow protocol:** Each task ships as one PR on a branch `feature/cloudflare-<NN>-<slug>`. Claude (orchestrator agent) writes the codex prompt, reviews the diff, runs gates, commits, pushes. User authorises merge. Auto-pipeline review skips on `feature/cloudflare-*` branches because no `docs/tickets/<NN>-*.md` file exists — review runs manually via `/ultrareview` if needed.

**Sequencing principle:** Bottom-up. Establish the Worker scaffold + DB binding _first_, then layer in services, then wire the new Pages build, then cut DNS over. Each task ends with a verifiable gate.

| Task   | Title                                                                                       | Branch                                     | Inputs / Dependencies | Verification gate                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | **Spike: Prisma driver-adapter + (local PG, then Hyperdrive)**                              | `spike/prisma-workers`                     | None                  | A throwaway Worker connects to Supabase via Hyperdrive, runs `SELECT 1`, executes `prisma.book.findMany()` from the existing schema, runs a transaction with serializable isolation, and runs `SELECT pg_try_advisory_xact_lock(99999)`. **Pass = all four work.** Fail = abort migration, escalate.                                                                                                                       |
| **2**  | **Workers project scaffolding**                                                             | `feature/cloudflare-02-scaffold`           | Task 1 ✅             | `apps/api/wrangler.toml` (production + staging envs, R2 + KV + Hyperdrive bindings stubbed); `apps/api/src/worker.ts` with `{ fetch, scheduled }` skeleton + a single `GET /health` Hono route returning `{app, status, db, uptimeSeconds, timestamp}` matching today's shape; `pnpm --filter @novelhub/api wrangler dev` runs locally; `curl localhost:8787/health` returns the parity envelope. CI: lint+typecheck pass. |
| **3**  | **Auth core (jose + Hono middleware)**                                                      | `feature/cloudflare-03-auth-core`          | Task 2 ✅             | Port `auth.service.ts` verbatim (drop `@Injectable`, accept deps via factory). Add Hono middleware `requireAuth`, `optionalAuth`, `requireAdmin`. Translate 8 auth controller routes to Hono. **Translate every class-validator DTO under `auth/dto/*` to Zod schemas.** Run existing `auth.service.spec.ts` (modify imports only — no logic changes); **all 50+ tests pass.**                                             |
| **4**  | **Books / Chapters / Reading-progress / Coins / Unlocks / Checkin**                         | `feature/cloudflare-04-catalog-and-coins`  | Task 3 ✅             | Port the 6 services + 6 controllers. Read endpoints work anonymously. Locked/unlocked chapter envelope is byte-identical to current `chapters.types.ts`. **Chapter-content allowlist regression from PR #60 (R2-only host) is preserved on the Web side; Worker side untouched.** All tests pass.                                                                                                                          |
| **5**  | **Storage clients (R2 binding + aws4fetch)**                                                | `feature/cloudflare-05-storage`            | Task 4 ✅             | New `R2WorkerClient` implements `StorageClient` interface using R2 binding for `uploadText`/`getText`, `aws4fetch` for `getSignedUrl`/`getSignedUploadUrl`. Existing chapter signed-URL test fixtures pass against the new client (1 h TTL, `Content-Type`, hostname). Manual test: issue a signed cover PUT URL, upload from curl, fetch back — round-trip works.                                                         |
| **6**  | **Cache client (KV-backed support rate-limit; book-list & preview stay no-op for Phase 1)** | `feature/cloudflare-06-cache`              | Task 5 ✅             | New `KvCacheClient` implements `CacheClient` for the support rate-limit path only. `support.service.ts` rate-limit test passes against KV-backed mock.                                                                                                                                                                                                                                                                     |
| **7**  | **Stripe payments + webhook (`constructEventAsync`)**                                       | `feature/cloudflare-07-stripe`             | Task 6 ✅             | Port `payments.service.ts` + `webhook.service.ts`. Single change: `constructEvent` → `await constructEventAsync` + `await c.req.arrayBuffer()`. Run `webhook.service.spec.ts` — **all idempotency / race / refund tests pass.** Manual test: `stripe listen --forward-to localhost:8787/payments/webhook`, then `stripe trigger checkout.session.completed`.                                                               |
| **8**  | **Notifications + cron via Cloudflare Cron Triggers**                                       | `feature/cloudflare-08-notifications-cron` | Task 7 ✅             | Port `NotificationsService` + `OneSignalClient`. Replace `@nestjs/schedule` with single `scheduled()` handler. `withCronLock` unchanged. Test: `wrangler dev --test-scheduled` triggers re-engagement run.                                                                                                                                                                                                                 |
| **9**  | **Admin (multipart, R2 puts, dashboard)**                                                   | `feature/cloudflare-09-admin`              | Task 8 ✅             | Port AdminService verbatim. Replace `FileInterceptor` with `c.req.formData()` + `file.arrayBuffer()`. **All 18 admin controller routes** translated to Hono. Existing admin specs pass. Manual test: upload 200 KB chapters file via curl.                                                                                                                                                                                 |
| **10** | **CAPI async-hash + Sentry Cloudflare**                                                     | `feature/cloudflare-10-observability`      | Task 9 ✅             | `fb-capi.service.ts.hashEmail` → async (Web Crypto). `@sentry/node` → `@sentry/cloudflare`. `SentryExceptionFilter` semantics replicated in `app.onError`. `SentryUserInterceptor` semantics replicated in middleware after `requireAuth`. CAPI tests pass.                                                                                                                                                                |
| **11** | **Migrate-on-deploy workflow → direct DB URL**                                              | `feature/cloudflare-11-migrations`         | Task 10 ✅            | `.github/workflows/migrate-on-deploy.yml` swaps `PRODUCTION_DATABASE_URL` → `PRODUCTION_DATABASE_URL_DIRECT`. CI passes. **No production deploy yet** — only renames a secret reference.                                                                                                                                                                                                                                   |
| **12** | **`deploy-api.yml` workflow + `wrangler deploy` per-env**                                   | `feature/cloudflare-12-deploy-api`         | Task 11 ✅            | New workflow on push to main: `wrangler deploy --env=production`. Deploys to `api.novelhub.com`. Smoke: `curl https://api.novelhub.com/health` returns parity envelope with `db: 'ok'`. **API live moment. Stripe webhook URL update happens next.**                                                                                                                                                                       |
| **13** | **Stripe webhook URL cutover**                                                              | `feature/cloudflare-13-stripe-cutover`     | Task 12 ✅            | User updates Stripe Dashboard webhook URL. New `whsec_...` rotated into Worker secret. Test webhook from Stripe Dashboard.                                                                                                                                                                                                                                                                                                 |
| **14** | **Pages migration (`@cloudflare/next-on-pages`)**                                           | `feature/cloudflare-14-pages`              | Task 13 ✅            | Add `@cloudflare/next-on-pages` + `vercel` build deps. Drop `output: 'standalone'`, set `images.unoptimized: true`. Drop `@vercel/analytics`. Configure Pages project. Smoke: preview URL renders home + book detail + reader (locked + free), authenticated `/me` works.                                                                                                                                                  |
| **15** | **DNS cutover**                                                                             | (no PR)                                    | Task 14 ✅            | User points `app.novelhub.com` at Pages, `cdn.novelhub.com` at R2 public bucket. Smoke checklist runs end-to-end against production domains.                                                                                                                                                                                                                                                                               |
| **16** | **Vercel teardown**                                                                         | `feature/cloudflare-16-vercel-teardown`    | Task 15 ✅            | Delete `apps/api/api/`, `apps/api/vercel.json`, `apps/api/Dockerfile`, the Vercel-specific bits of `.env.example`. Update `docs/runbook.md` to be the Cloudflare playbook. User pauses/deletes Vercel projects.                                                                                                                                                                                                            |
| **17** | **End-to-end smoke pass**                                                                   | (no PR)                                    | Task 16 ✅            | Run `scripts/smoke.sh` (retargeted at `https://api.novelhub.com`) against prod: 15/15 PASS. Admin login + chapter import manually. Stripe test-mode coin purchase end-to-end. **Then user authorises live-mode rotation.**                                                                                                                                                                                                 |
| **18** | **(Phase 2 deferred)**                                                                      | —                                          | —                     | Cloudflare Images for cover optimization; Cloudflare Web Analytics; Hyperdrive Cache for read endpoints.                                                                                                                                                                                                                                                                                                                   |
| **19** | **Memory + runbook updates**                                                                | `feature/cloudflare-19-docs`               | Task 17 ✅            | Update `project_status.md`, the runbook, README.                                                                                                                                                                                                                                                                                                                                                                           |

**Out of scope for Phase 0/1:**

- Schema changes (none).
- New product features.
- Test framework changes (Jest → Vitest swap is a separate decision).
- Internationalization beyond the existing `messages/en.json`.
- Replacing `OneSignal` with native Web Push.

**Estimated calendar time** (sequential, with Claude doing reviews): 5–7 working days from Task 1 spike to Task 17 prod smoke. Task 1 is the gating spike — if it passes, the rest is mechanical.
