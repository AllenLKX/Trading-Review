#!/usr/bin/env bash
set -euo pipefail

target_file="${1:-.env.local}"

read -r -s -p "DeepSeek API Key: " api_key
printf '\n'

if [[ -z "${api_key}" ]]; then
  echo "Key cannot be empty."
  exit 1
fi

touch "${target_file}"
chmod 600 "${target_file}"

temp_file="$(mktemp)"
trap 'rm -f "${temp_file}"' EXIT

grep -Ev '^(DEEPSEEK_API_KEY|AI_API_KEY|AI_BASE_URL|AI_MODEL|AI_TIMEOUT_MS)=' "${target_file}" >"${temp_file}" || true
{
  cat "${temp_file}"
  printf '%s\n' \
    "DEEPSEEK_API_KEY=${api_key}" \
    "AI_BASE_URL=https://api.deepseek.com" \
    "AI_MODEL=deepseek-v4-flash" \
    "AI_TIMEOUT_MS=20000"
} >"${target_file}"

chmod 600 "${target_file}"
echo "DeepSeek configuration saved to ${target_file}. Restart the app process before verification."
