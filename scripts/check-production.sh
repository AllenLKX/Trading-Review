#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

echo "Checking ${BASE_URL}"

curl -fsS "${BASE_URL}/api/health" >/dev/null
curl -fsS "${BASE_URL}/api/system/status" >/dev/null

echo "Production smoke check passed."
