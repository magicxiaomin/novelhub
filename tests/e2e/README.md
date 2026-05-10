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

## Drama HLS Fixture

`specs/drama.spec.ts` intercepts `https://media.dramavela.test/hls/**` and serves the deterministic files in `fixtures/hls/`. Keep seeded drama playback URLs on the `media.dramavela.test` fixture host so local and CI e2e never depend on a third-party HLS provider.
