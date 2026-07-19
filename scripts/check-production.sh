#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

echo "Checking ${BASE_URL}"

AUTH_ARGS=()
if [[ -n "${APP_ACCESS_USERNAME:-}" && -n "${APP_ACCESS_PASSWORD:-}" ]]; then
  AUTH_ARGS=(--user "${APP_ACCESS_USERNAME}:${APP_ACCESS_PASSWORD}")
fi

curl -fsS "${BASE_URL}/api/health" >/dev/null
curl -fsS "${AUTH_ARGS[@]}" "${BASE_URL}/api/system/status" >/dev/null

echo "Production smoke check passed."
