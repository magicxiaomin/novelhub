# NovelHub Playwright E2E

Browser-level checks for the public reading and pre-checkout money path.

## Local Run

Start Postgres and Redis, then migrate and seed the database:

```sh
pnpm --filter @novelhub/db prisma:generate
pnpm --filter @novelhub/db prisma:migrate-deploy
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm --filter @novelhub/db prisma:seed
```

Run the API and web app in separate shells:

```sh
pnpm --filter @novelhub/api dev
```

```sh
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_IMAGE_HOST=picsum.photos pnpm --filter @novelhub/web dev
```

Install Chromium once, then run the suite:

```sh
pnpm --filter @novelhub/e2e install-browsers
pnpm --filter @novelhub/e2e test
```

Set `PLAYWRIGHT_BASE_URL` to target a non-default web origin.

## Drama HLS Regression

The deterministic drama HLS smoke can be run directly with:

```sh
NOVELHUB_E2E_DRAMA_FIXTURES=1 pnpm --filter @novelhub/e2e test -- --project=chromium tests/e2e/specs/drama-regression.spec.ts
```

`NOVELHUB_E2E_DRAMA_FIXTURES=1` is for local/CI Playwright runs only. It enables SSR-safe deterministic drama fixture data and is guarded off when `NODE_ENV=production`; do not add it to production deployment guidance or hosted runtime environments.
