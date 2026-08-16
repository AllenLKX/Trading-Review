#!/usr/bin/env bash
set -euo pipefail

target_file="${1:-.env.production}"
if [[ ! -f "$target_file" ]]; then
  echo "Environment file not found: $target_file" >&2
  exit 1
fi

set -a
source "$target_file"
set +a

read -r -p "Owner email: " owner_email
read -r -s -p "Owner password (8-128 characters): " owner_password
printf '\n'
printf '%s\n%s\n' "$owner_email" "$owner_password" | node scripts/bootstrap-owner-account.mjs
unset owner_password
