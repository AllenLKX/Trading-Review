#!/usr/bin/env bash
set -euo pipefail

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3000 is currently in use."
  echo "Stop the local dev server before running production build verification."
  echo "Reason: next dev and next build both write .next, which can corrupt dev chunks."
  exit 1
fi

pnpm typecheck
pnpm build

echo "Local verification passed."
