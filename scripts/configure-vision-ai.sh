#!/usr/bin/env bash
set -euo pipefail

target_file="${1:-.env.local}"

read -r -s -p "Tencent TokenHub API Key: " api_key
printf '\n'

if [[ -z "${api_key}" ]]; then
  echo "Key cannot be empty."
  exit 1
fi

touch "${target_file}"
chmod 600 "${target_file}"

temp_file="$(mktemp)"
trap 'rm -f "${temp_file}"' EXIT

grep -Ev '^(VISION_AI_API_KEY|VISION_AI_BASE_URL|VISION_AI_MODEL|VISION_AI_TIMEOUT_MS)=' "${target_file}" >"${temp_file}" || true
{
  cat "${temp_file}"
  printf '%s\n' \
    "VISION_AI_API_KEY=${api_key}" \
    "VISION_AI_BASE_URL=https://tokenhub.tencentmaas.com/v1" \
    "VISION_AI_MODEL=kimi-k3" \
    "VISION_AI_TIMEOUT_MS=120000"
} >"${target_file}"

chmod 600 "${target_file}"
echo "Kimi K3 vision configuration saved to ${target_file}. Restart the app process before verification."
