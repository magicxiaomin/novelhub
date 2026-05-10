# NovelHub Operations Runbook

Last verified: 2026-05-10. Update this file as the topology changes.

## Environments at a glance

|               | Staging                                  | Production                                  |
| ------------- | ---------------------------------------- | ------------------------------------------- |
| Frontend      | https://staging.whoryou.club             | https://dramavela.com (+ www.dramavela.com) |
| API           | https://api-staging.whoryou.club         | https://api.dramavela.com                   |
| Pages project | `novelhub-web-staging`                   | `novelhub-web`                              |
| Worker name   | `novelhub-api-staging`                   | `novelhub-api`                              |
| Hyperdrive    | `ee7db7e85d78487796c06ba032a8c469`       | `7598b12e346d473b99d2e9ca4f64d054`          |
| R2 bucket     | `novelhub-content-staging`               | `novelhub-content`                          |
| Postgres      | Supabase Singapore (Session pooler 5432) | Supabase Sydney (Session pooler 5432)       |
| Stripe mode   | test                                     | test (live mode pending)                    |

KV namespace `6a22d526fa6841439f4b5517fe821730` is shared across both Workers — rate-limit keys are IP+email-scoped, no cross-env collision risk.

## Daily workflow (writing & shipping a feature)

```
1. git checkout main && git pull
2. git checkout -b feature/<short-slug>
3. Code locally:
   - apps/api: pnpm --filter @novelhub/api start:dev   (Nest, :4000)
   - apps/web: pnpm --filter @novelhub/web dev         (Next, :3000)
4. Local gates before push:
   - pnpm --filter @novelhub/api {lint,typecheck,test}
   - pnpm --filter @novelhub/web {lint,typecheck,test,build}
5. git push -u origin feature/<slug> → opens PR automatically
6. CI fires (no human action):
   - pr-checks.yml: lint + test + typecheck
   - e2e.yml: Playwright against full stack
   - claude-review.yml: correctness + security + path/size policy
   - db-migration-check.yml: only if schema.prisma touched
7. Address review verdicts. Re-push if changes needed.
8. After both Claude verdicts APPROVE and CI green: gh pr merge <num> --squash --delete-branch
9. Push-to-main fires the deploy chain:
   - Migrate Production DB (no-op until PRODUCTION_DATABASE_URL_DIRECT secret is set)
   - Deploy API (Cloudflare Workers): staging deploy auto-fires
   - Deploy Web (Cloudflare Pages): staging deploy auto-fires after PR Checks completes
10. Verify on staging:
    - Browse https://staging.whoryou.club
    - API=https://api-staging.whoryou.club bash scripts/smoke.sh   → expect 16/16
11. Promote to production (manual):
    - GitHub → Actions → Deploy Web → Run workflow → environment: production-only
    - GitHub → Actions → Deploy API → Run workflow → environment: production-only
    - API=https://api.dramavela.com bash scripts/smoke.sh   → expect 16/16
```

Production deploy is intentionally manual — staging is the gate.

## Schema changes

Schema lives at `packages/db/prisma/schema.prisma`. Migrations are append-only (`db-migration-check.yml` enforces this on PRs).

```
1. Edit schema.prisma
2. pnpm --filter @novelhub/db prisma:migrate    # generates migrations/<ts>_<name>/migration.sql
3. Commit BOTH the schema and the new migration
4. PR review as usual
5. After merge, the staging Worker / Web auto-redeploy will run against
   the existing staging DB. To apply the migration to staging DB, run:
     DATABASE_URL=$STAGING_DB pnpm --filter @novelhub/db prisma:migrate-deploy
6. Same procedure for prod when ready:
     DATABASE_URL=$PROD_DB pnpm --filter @novelhub/db prisma:migrate-deploy
   (or set PRODUCTION_DATABASE_URL_DIRECT in GitHub secrets to make
   migrate-on-deploy.yml run automatically against prod on merge.)
```

If you need to undo a schema change: write a NEW migration that reverses it. Never delete or modify an existing migration file.

## Worker secrets

Stored on Cloudflare per environment, not in GitHub. Update via wrangler from a local terminal:

```sh
echo "<value>" | wrangler secret put <NAME> --env <staging|production>
wrangler secret list --env <staging|production>
echo y | wrangler secret delete <NAME> --env <staging|production>
```

Required secrets per env (current state):

- `DATABASE_URL` — Supabase Session Pooler URL (port 5432)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_RESET_SECRET` — 96-char hex (`openssl rand -hex 48`)
- `NEXT_PUBLIC_APP_URL` — canonical frontend URL (CORS allowlist primary)
- `NODE_ENV` — `production` (always)
- `COOKIE_CROSS_SITE` — `true` (Pages and Worker are on different registrable domains)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET` — R2 S3-API creds for signed URL generation

Optional / future:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — when going live
- `RESEND_API_KEY`, `EMAIL_FROM` — transactional email
- `SENTRY_DSN` — error monitoring
- `CORS_EXTRA_ORIGINS` — comma-separated extras (currently empty after split)

## Manual one-off operations

### Re-seed staging or prod DB

```sh
source /root/.novelhub-secrets
DATABASE_URL=$STAGING_DB pnpm --filter @novelhub/db prisma:seed
# or
DATABASE_URL=$PROD_DB    pnpm --filter @novelhub/db prisma:seed
```

Seed is idempotent (upserts). With `R2_*` env also exported, the seed will also upload chapter `.txt` files to R2.

### Manual chapter content upload to R2

```sh
export PATH="/root/.hermes/node/bin:/root/workspace/novelhub/apps/api/node_modules/.bin:$PATH"
source /root/.novelhub-secrets
for book in pride-and-prejudice sherlock-holmes frankenstein; do
  for n in 01 02 03 04 05 06 07 08 09 10; do
    wrangler r2 object put "novelhub-content/chapters/${book}/chapter-${n}.txt" \
      --file "apps/api/static/chapters/${book}/chapter-${n}.txt" \
      --content-type "text/plain; charset=utf-8"
  done
done
```

(Replace bucket name `novelhub-content` with `novelhub-content-staging` for staging.)

### Update R2 CORS rules

```sh
cat > /tmp/r2-cors.json <<'EOF'
{
  "rules": [{
    "allowed": {
      "origins": ["https://dramavela.com"],
      "methods": ["GET", "HEAD"],
      "headers": ["*"]
    },
    "exposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "maxAgeSeconds": 3600
  }]
}
EOF
wrangler r2 bucket cors set <bucket> --file /tmp/r2-cors.json --force
wrangler r2 bucket cors list <bucket>
```

## Rollback

### Worker rollback

```sh
cd apps/api
wrangler rollback --env <staging|production>
# Lists recent versions, asks which to roll back to
```

### Pages rollback

1. Cloudflare Dashboard → Pages → `novelhub-web` → Deployments
2. Find the last good deployment
3. Click `...` → "Promote to production"
   (No CLI for this as of 2026-05.)

### DB rollback

Migrations are forward-only. To revert: write a new migration that reverses the change. Never delete a migration that has been applied to any environment.

## Smoke tests

```sh
# staging
API=https://api-staging.whoryou.club bash scripts/smoke.sh

# production
API=https://api.dramavela.com bash scripts/smoke.sh
```

Both should return `Summary: 16 passed, 0 failed`. The signed-URL round-trip step (`GET signed contentUrl`) requires the `R2_*` Worker secrets to be set on the target env — failure there points to missing or stale R2 access keys.

## Common failures and fixes

### Smoke "GET signed contentUrl 404"

Cause: prod DB's `chapters.contentUrl` references an R2 key that doesn't exist in the bucket. Fix: re-upload via "Manual chapter content upload" above, or re-run seed with R2 env exported.

### Browser "Chapter content could not be loaded"

Cause: same as above, but visible to the user. The signed URL is valid but the bucket has no object at that key.

### Browser CORS error on R2 fetch

Cause: R2 bucket CORS allowlist doesn't include the page's origin. Fix: update R2 CORS via "Update R2 CORS rules" above.

### Worker `/auth/me` 401 in console

Expected. The frontend probes anon auth state on page load; a logged-out user gets 401. Not a bug.

### Pages 522 right after binding a custom domain

SSL cert still provisioning — wait ~5 min and retry.

### `wrangler exec wrangler ... command not found` in CI

Wrangler isn't a direct dep of the workspace doing the deploy. Add `wrangler` to that workspace's `devDependencies` (pinned to match the existing `apps/api` version) and re-run.

### China cold-start: brand-new .com domain not resolving

Wait 30–60 minutes. Chinese ISPs cache new .com domains slowly. `staging.whoryou.club` (.club) is a useful fallback during that window.

## Self-hosted runner (Claude review pipeline)

The runner lives at `/opt/actions-runner/` on the VPS, runs as user `runner`, drives `claude -p` for the auto-review jobs. If reviews silently come back as `Verdict: COMMENT`:

```sh
cp /root/.claude/.credentials.json /home/runner/.claude/.credentials.json
chown runner:runner /home/runner/.claude/.credentials.json
chmod 600 /home/runner/.claude/.credentials.json
```

Then re-run the failing GitHub Actions run.

If the runner is offline entirely:

```sh
systemctl status actions.runner.magicxiaomin-novelhub.novelhub-vps.service
systemctl restart actions.runner.magicxiaomin-novelhub.novelhub-vps.service
```

## Repo configuration

GitHub repo secrets:

- `CLOUDFLARE_API_TOKEN` — User API token (Workers Scripts/KV/R2 + Zone DNS Edit on whoryou.club + dramavela.com)
- `CLOUDFLARE_ACCOUNT_ID` — `0ead643bec90bb38a1f209ec3cec02bb`
- `ANTHROPIC_API_KEY` — present but unused since runner uses Claude Max OAuth

GitHub repo variables:

- `STAGING_API_URL` = `https://api-staging.whoryou.club`
- `PRODUCTION_API_URL` = `https://api.dramavela.com`
- `STAGING_WEB_URL` = `https://staging.whoryou.club`
- `PRODUCTION_WEB_URL` = `https://dramavela.com`

VPS-side secrets at `/root/.novelhub-secrets` (mode 600):

- `CLOUDFLARE_API_TOKEN` — same value as GH secret
- `CLOUDFLARE_ACCOUNT_ID` — same
- `STAGING_DB` — Supabase Singapore Session pooler URL with password
- `PROD_DB` — Supabase Sydney Session pooler URL with password
