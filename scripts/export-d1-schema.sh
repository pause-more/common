#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
D1_DATABASE="${D1_DATABASE:-autone-groupware-db}"
SCHEMA_FILE="${SCHEMA_FILE:-${ROOT_DIR}/schema/groupware-schema.sql}"

cd "${ROOT_DIR}"
mkdir -p "$(dirname "${SCHEMA_FILE}")"

echo "Exporting D1 schema from ${D1_DATABASE}"
echo "Output: ${SCHEMA_FILE}"

npx wrangler d1 export "${D1_DATABASE}" \
  --remote \
  --output "${SCHEMA_FILE}" \
  --no-data \
  --skip-confirmation

echo "D1 schema export complete."
