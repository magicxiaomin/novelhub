#!/usr/bin/env bash
# Walk the canonical user-flow endpoints and report PASS/FAIL for each.
# Useful for the operational launch QA pass and as a CI-adjacent sanity check
# against a fresh deploy. Treats every check as independent so the script
# returns a single non-zero exit code if any step fails but always runs to
# the end so you see the whole picture.
#
# Usage:
#   API=http://localhost:4000 ./scripts/smoke.sh
#   API=https://api.example.com ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/smoke.sh

set -uo pipefail

API="${API:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@novelhub.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin12345}"

PASS=0
FAIL=0
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
gray()  { printf '\033[90m%s\033[0m\n' "$*"; }

check() {
  local description="$1"; shift
  local expected_status="$1"; shift
  local response
  : >/tmp/smoke.body
  response=$(curl -s -o /tmp/smoke.body -w '%{http_code}' "$@" 2>/dev/null)
  : "${response:=000}"
  if [ "$response" = "$expected_status" ]; then
    green "  PASS  $description (HTTP $response)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $description (expected $expected_status, got $response)"
    gray "        body: $(head -c 200 /tmp/smoke.body 2>/dev/null || echo '<no body>')"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke testing $API"
echo

# === Anonymous endpoints ===
gray "Anonymous"
check "GET /docs (Swagger UI)"        200 "$API/docs"
check "GET /books (catalog)"          200 "$API/books"
check "GET /books/categories"         200 "$API/books/categories"
check "GET /books/featured"           200 "$API/books/featured"
check "GET /books/trending"           200 "$API/books/trending"
check "GET /reading-progress (no auth, 401)" 401 "$API/reading-progress"
check "POST /reading-progress (no auth, 401)" 401 -X POST -H 'Content-Type: application/json' \
  -d '{"chapterId":"00000000-0000-4000-8000-000000000000","scrollPercent":10}' \
  "$API/reading-progress"

# Pull a free chapter id from the seeded catalog so the next checks aren't
# tied to a particular UUID.
BOOK_ID=$(curl -sS "$API/books" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["items"][0]["id"])' 2>/dev/null || echo "")
if [ -n "$BOOK_ID" ]; then
  CHAPTER_ID=$(curl -sS "$API/books/$BOOK_ID/chapters?limit=1" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["items"][0]["id"])' 2>/dev/null || echo "")
  if [ -n "$CHAPTER_ID" ]; then
    gray "Resolved seed chapter $CHAPTER_ID for downstream checks"
    check "GET /chapters/:id (free chapter, anon)" 200 "$API/chapters/$CHAPTER_ID"
  else
    red "  SKIP  Could not resolve seeded chapter id; downstream chapter checks skipped"
  fi
else
  red "  SKIP  Could not resolve seeded book id; downstream chapter checks skipped"
fi

# === Authenticated as admin ===
echo
gray "Authenticated as admin ($ADMIN_EMAIL)"
: >/tmp/smoke.body
SIGNIN_STATUS=$(curl -s -o /tmp/smoke.body -w '%{http_code}' -c "$COOKIE_JAR" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$API/auth/login" 2>/dev/null)
: "${SIGNIN_STATUS:=000}"
if [ "$SIGNIN_STATUS" = "200" ]; then
  green "  PASS  POST /auth/login (admin)"
  PASS=$((PASS + 1))
  check "GET /auth/me (cookie auth)"     200 -b "$COOKIE_JAR" "$API/auth/me"
  check "GET /reading-progress (recent)" 200 -b "$COOKIE_JAR" "$API/reading-progress"
  check "GET /unlocks (paginated)"       200 -b "$COOKIE_JAR" "$API/unlocks"
  check "GET /coins/balance"             200 -b "$COOKIE_JAR" "$API/coins/balance"
  check "GET /payments/subscription"     200 -b "$COOKIE_JAR" "$API/payments/subscription"
  check "GET /admin/books (admin gate)"  200 -b "$COOKIE_JAR" "$API/admin/books"
else
  red "  FAIL  POST /auth/login (admin) (HTTP $SIGNIN_STATUS)"
  gray "        body: $(head -c 200 /tmp/smoke.body)"
  FAIL=$((FAIL + 1))
fi

echo
echo "Summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
