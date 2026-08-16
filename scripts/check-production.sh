#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

echo "Checking ${BASE_URL}"

for attempt in $(seq 1 30); do
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi

  if [[ "${attempt}" == "30" ]]; then
    echo "Production health check timed out." >&2
    exit 1
  fi

  sleep 1
done

if [[ -n "${APP_ACCESS_USERNAME:-}" && -n "${APP_ACCESS_PASSWORD:-}" ]]; then
  curl -fsS --user "${APP_ACCESS_USERNAME}:${APP_ACCESS_PASSWORD}" "${BASE_URL}/api/system/status" >/dev/null
else
  curl -fsS "${BASE_URL}/api/system/status" >/dev/null
fi

echo "Production smoke check passed."
