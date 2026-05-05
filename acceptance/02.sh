#!/usr/bin/env bash
# Acceptance script for Ticket 02 — Database Schema with Prisma.
#
# Runs from repo root in CI (sanity-check.yml). Exits 0 only when every
# Acceptance Criterion below passes. Database-dependent checks are skipped
# when $DATABASE_URL is unset (local without DB); CI must set DATABASE_URL.

set -euo pipefail

SCHEMA="packages/db/prisma/schema.prisma"
SEED="packages/db/prisma/seed.mjs"

echo "checking: packages/db/prisma/schema.prisma exists"
test -f "$SCHEMA"

echo "checking: schema declares all 10 required models"
for m in User Book Chapter ReadingProgress ChapterUnlock CoinTransaction Subscription Order DailyCheckin FbEvent; do
  grep -qE "^model[[:space:]]+$m[[:space:]]" "$SCHEMA" || {
    echo "FAIL: model $m missing in $SCHEMA"
    exit 1
  }
done

echo "checking: User has email @unique"
grep -qE 'email[[:space:]]+String[[:space:]]+@unique' "$SCHEMA"

echo "checking: User has soft-delete deletedAt"
grep -qE 'deletedAt[[:space:]]+DateTime\?' "$SCHEMA"

echo "checking: ReadingProgress has both userId and guestId nullable"
awk '/^model ReadingProgress/,/^}/' "$SCHEMA" | grep -qE 'userId[[:space:]]+String\?'
awk '/^model ReadingProgress/,/^}/' "$SCHEMA" | grep -qE 'guestId[[:space:]]+String\?'

echo "checking: Chapter has unique (bookId, order)"
awk '/^model Chapter/,/^}/' "$SCHEMA" | grep -qE '@@unique\(\[bookId,[[:space:]]*order\]\)'

echo "checking: ChapterUnlock has unique (userId, chapterId)"
awk '/^model ChapterUnlock/,/^}/' "$SCHEMA" | grep -qE '@@unique\(\[userId,[[:space:]]*chapterId\]\)'

echo "checking: Subscription has stripeSubscriptionId @unique"
awk '/^model Subscription/,/^}/' "$SCHEMA" | grep -qE 'stripeSubscriptionId[[:space:]]+String[[:space:]]*\??[[:space:]]+@unique'

echo "checking: FbEvent has eventId @unique (idempotency)"
awk '/^model FbEvent/,/^}/' "$SCHEMA" | grep -qE 'eventId[[:space:]]+String[[:space:]]+@unique'

echo "checking: seed script exists"
test -f "$SEED"

echo "checking: db package exposes runtime entrypoints (Ticket 01 lesson)"
test -f packages/db/index.js
test -f packages/db/index.d.ts
grep -q '"main"' packages/db/package.json
grep -q '"types"' packages/db/package.json

echo "checking: prisma client generates without error"
pnpm --filter @novelhub/db prisma:generate >/dev/null

echo "checking: cross-package runtime import resolves and exports prisma"
node -e "const m = require('@novelhub/db'); if (!m.prisma || typeof m.prisma.\$connect !== 'function') { console.error('FAIL: @novelhub/db did not export a working prisma client at runtime'); process.exit(1); }"

echo "checking: apps/api smoke test exists for cross-package import"
test -f apps/api/test/prisma-import.smoke.spec.ts

echo "checking: apps/api lists @novelhub/db as a workspace dependency"
grep -qE '"@novelhub/db"[[:space:]]*:[[:space:]]*"workspace:\*"' apps/api/package.json

echo "checking: root package.json exposes prisma:migrate and prisma:seed scripts"
grep -qE '"prisma:migrate"[[:space:]]*:' package.json
grep -qE '"prisma:seed"[[:space:]]*:' package.json

if [ -n "${DATABASE_URL:-}" ]; then
  echo "checking: prisma:migrate deploy succeeds against \$DATABASE_URL"
  pnpm --filter @novelhub/db prisma:migrate deploy

  echo "checking: prisma:seed succeeds first run"
  pnpm --filter @novelhub/db prisma:seed

  echo "checking: prisma:seed is idempotent (second run also succeeds)"
  pnpm --filter @novelhub/db prisma:seed
else
  echo "skip: DATABASE_URL unset — DB checks deferred to env that has Postgres"
fi

echo "all checks passed"
