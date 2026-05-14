#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat >"$TMPDIR/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
out=""
write_code=false
url=""
has_cookie=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      out="$2"; shift 2 ;;
    -w)
      write_code=true; shift 2 ;;
    -b)
      has_cookie=true; shift 2 ;;
    -*)
      if [ "$1" = "-d" ] || [ "$1" = "-H" ] || [ "$1" = "-c" ] || [ "$1" = "-X" ]; then
        shift 2
      else
        shift
      fi ;;
    *)
      url="$1"; shift ;;
  esac
done
status=200
body='{}'
case "$url" in
  */health) body='{"ok":true}' ;;
  */books) body='{"items":[{"id":"book-1"}]}' ;;
  */books/categories|*/books/featured|*/books/trending) body='{"items":[]}' ;;
  */books/book-1/chapters*) body='{"items":[{"id":"chapter-1"}]}' ;;
  */chapters/chapter-1) body='{"contentUrl":"http://fake/content"}' ;;
  http://fake/content) body='This is fake chapter content long enough to satisfy the smoke test byte threshold. Lorem ipsum dolor sit amet, consectetur adipiscing elit.' ;;
  */reading-progress) if [ "$has_cookie" = true ]; then body='{}'; else status=401; body='{"message":"Unauthorized"}'; fi ;;
  */auth/login) body='{"ok":true}' ;;
  */auth/me|*/unlocks|*/coins/balance|*/payments/subscription|*/admin/books) body='{}' ;;
  *) body='{}' ;;
esac
if [ -n "$out" ]; then printf '%s' "$body" >"$out"; else printf '%s' "$body"; fi
if [ "$write_code" = true ]; then printf '%s' "$status"; fi
FAKE_CURL
chmod +x "$TMPDIR/curl"

run_smoke() {
  PATH="$TMPDIR:$PATH" API=http://fake ADMIN_EMAIL=a@example.test ADMIN_PASSWORD=secret \
    bash "$ROOT/scripts/smoke.sh"
}

output=$(run_smoke)

echo "smoke.test.sh PASS"
