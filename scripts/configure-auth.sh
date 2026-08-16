#!/usr/bin/env bash
set -euo pipefail

action="${1:-}"
target_file="${2:-.env.production}"
if [[ "$action" != "prepare" && "$action" != "enable" ]]; then
  echo "Usage: $0 prepare|enable [.env.production]" >&2
  exit 1
fi
if [[ ! -f "$target_file" ]]; then
  echo "Environment file not found: $target_file" >&2
  exit 1
fi

existing_secret="$(grep -E '^AUTH_SESSION_SECRET=' "$target_file" | tail -n 1 | cut -d= -f2- || true)"
if [[ -z "$existing_secret" ]]; then
  existing_secret="$(openssl rand -base64 48 | tr -d '\n')"
fi

temp_file="$(mktemp)"
trap 'rm -f "$temp_file"' EXIT
grep -Ev '^(AUTH_MODE|AUTH_SESSION_SECRET|AUTH_ALLOW_REGISTRATION|AUTH_SESSION_DAYS)=' "$target_file" >"$temp_file" || true

if [[ "$action" == "prepare" ]]; then
  auth_mode="basic"
  registration="false"
else
  auth_mode="session"
  registration="true"
fi

printf '%s\n' \
  "AUTH_MODE=$auth_mode" \
  "AUTH_SESSION_SECRET=$existing_secret" \
  "AUTH_ALLOW_REGISTRATION=$registration" \
  "AUTH_SESSION_DAYS=30" >>"$temp_file"

install -m 600 "$temp_file" "$target_file"
echo "Authentication configuration updated: mode=$auth_mode registration=$registration"
