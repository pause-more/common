#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
D1_DATABASE="${D1_DATABASE:-autone-groupware-db}"
SCHEMA_FILE="${SCHEMA_FILE:-${ROOT_DIR}/schema/groupware-schema.sql}"

cd "${ROOT_DIR}"

if [[ "${CONFIRM_APPLY:-}" != "YES" ]]; then
  echo "This applies a schema file to remote D1: ${D1_DATABASE}"
  echo "Set CONFIRM_APPLY=YES to continue."
  exit 1
fi

if [[ ! -s "${SCHEMA_FILE}" ]]; then
  echo "Schema file is missing or empty: ${SCHEMA_FILE}"
  exit 1
fi

echo "Applying D1 schema to ${D1_DATABASE}"
echo "Input: ${SCHEMA_FILE}"

npx wrangler d1 execute "${D1_DATABASE}" \
  --remote \
  --file "${SCHEMA_FILE}"

echo "D1 schema apply complete."
