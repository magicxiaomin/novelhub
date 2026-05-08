# Prisma Driver-Adapter Spike

This throwaway spike validates the load-bearing Prisma driver-adapter mechanism against the NovelHub PostgreSQL schema without changing product code. It checks that Prisma can connect through the Node `pg` adapter, read mapped schema fields, open a serializable transaction, and execute the advisory lock query used by API leader election. The future Hyperdrive run should be a connection-layer swap against Cloudflare's PostgreSQL-compatible Hyperdrive URL.

## Local Run

```sh
cd apps/api/spike
pnpm install --ignore-workspace
pnpm exec prisma generate --schema prisma/spike.schema.prisma
DATABASE_URL='postgresql://novelhub:novelhub_local@localhost:5432/novelhub' \
  node scripts/run-spike-local.mjs
```

The script does not echo `DATABASE_URL`. It exits `0` only when all four checks pass, `1` if any check fails, and `2` when `DATABASE_URL` is missing.

## Result File

The local script writes machine-readable output to `/tmp/spike-prisma-results.json`. Inspect `allPass` for the overall result and `checks[]` for each check's name, pass/fail state, elapsed milliseconds, and detail or error text.

## Hyperdrive Next Step

`scripts/run-spike-hyperdrive.mjs` is a reference-only Worker skeleton for the real Cloudflare validation. Running it requires `wrangler login`, a configured Hyperdrive binding pointed at Supabase, and `wrangler dev`; that is intentionally out of scope for this local sandbox spike.

## Lifecycle

This spike is throwaway. The `spike/prisma-workers` branch will not merge to main. After Claude reviews the spike output, the next concrete work is Task 2, Workers project scaffolding, on `feature/cloudflare-02-scaffold`.
