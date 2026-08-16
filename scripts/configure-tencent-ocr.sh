#!/usr/bin/env bash
set -euo pipefail

target_file="${1:-.env.local}"

read -r -s -p "Tencent Cloud SecretId: " secret_id
printf '\n'
read -r -s -p "Tencent Cloud SecretKey: " secret_key
printf '\n'
read -r -p "OCR region [ap-guangzhou]: " region
region="${region:-ap-guangzhou}"

if [[ -z "${secret_id}" || -z "${secret_key}" ]]; then
  echo "SecretId and SecretKey cannot be empty."
  exit 1
fi

touch "${target_file}"
chmod 600 "${target_file}"

temp_file="$(mktemp)"
trap 'rm -f "${temp_file}"' EXIT

grep -Ev '^(TENCENT_OCR_SECRET_ID|TENCENT_OCR_SECRET_KEY|TENCENT_OCR_REGION)=' "${target_file}" >"${temp_file}" || true
{
  cat "${temp_file}"
  printf '%s\n' \
    "TENCENT_OCR_SECRET_ID=${secret_id}" \
    "TENCENT_OCR_SECRET_KEY=${secret_key}" \
    "TENCENT_OCR_REGION=${region}"
} >"${target_file}"

chmod 600 "${target_file}"
echo "Tencent Cloud OCR configuration saved to ${target_file}. Restart the app process before verification."
