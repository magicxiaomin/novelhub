#!/usr/bin/env bash
# Staging smoke test orchestrator. Runs all per-ticket smoke contributions
# under acceptance/*-smoke.sh against the running staging deployment.
#
# Each acceptance/NN-smoke.sh is a script Codex contributes alongside its
# acceptance/NN.sh. The smoke variant exercises HTTP endpoints / actual
# behavior against $STAGING_HEALTH_URL's host (a related env var per ticket
# is fine: STAGING_BASE_URL, STAGING_API_URL etc.).
#
# Exits 0 only if every smoke script exits 0. Each script is run with:
#   - STAGING_BASE_URL  - derived from STAGING_HEALTH_URL by stripping /health
#   - timeout 60s per script
#
# Skipped silently if no smoke scripts exist (early in the ticket run when
# only Ticket 01 has merged and there are no smoke contributions yet).

set -euo pipefail

if [ -z "${STAGING_HEALTH_URL:-}" ]; then
  echo "STAGING_HEALTH_URL not set; cannot derive STAGING_BASE_URL"
  exit 1
fi

# Strip trailing /health (or /health/) to get the base URL
export STAGING_BASE_URL="${STAGING_HEALTH_URL%/health}"
export STAGING_BASE_URL="${STAGING_BASE_URL%/health/}"
export STAGING_BASE_URL="${STAGING_BASE_URL%/}"

shopt -s nullglob
SCRIPTS=(acceptance/*-smoke.sh)
if [ "${#SCRIPTS[@]}" -eq 0 ]; then
  echo "No acceptance/*-smoke.sh scripts present; smoke check is a no-op."
  exit 0
fi

FAIL=0
for s in "${SCRIPTS[@]}"; do
  echo "::group::$s"
  if ! timeout 60s bash "$s"; then
    echo "FAILED: $s"
    FAIL=1
  else
    echo "OK: $s"
  fi
  echo "::endgroup::"
done

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "All smoke scripts passed."
exit 0
