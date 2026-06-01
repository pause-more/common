#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/Desktop/groupware-backups}"
BACKUP_DIR="${BACKUP_DIR:-$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)}"
D1_DATABASE="${D1_DATABASE:-autone-groupware-db}"
KV_BINDING="${KV_BINDING:-MAIL_KV}"

cd "${ROOT_DIR}"
mkdir -p "${BACKUP_DIR}/d1" "${BACKUP_DIR}/kv" "${BACKUP_DIR}/r2" "${BACKUP_DIR}/meta"

echo "Backup directory: ${BACKUP_DIR}"

echo "Exporting D1 database..."
npx wrangler d1 export "${D1_DATABASE}" \
  --remote \
  --output "${BACKUP_DIR}/d1/groupware-db.sql" \
  --skip-confirmation

echo "Saving D1 info..."
npx wrangler d1 info "${D1_DATABASE}" --json > "${BACKUP_DIR}/meta/d1-info.json"

echo "Saving KV key list..."
npx wrangler kv key list \
  --binding "${KV_BINDING}" \
  --remote \
  > "${BACKUP_DIR}/kv/kv-keys.json"

echo "Saving R2 object key metadata from D1..."
npx wrangler d1 execute "${D1_DATABASE}" \
  --remote \
  --command "SELECT object_key FROM cloud_files WHERE object_key IS NOT NULL AND object_key != ''" \
  --json \
  > "${BACKUP_DIR}/r2/object-keys.json" || true

echo "Copying local config metadata..."
cp wrangler.toml "${BACKUP_DIR}/meta/wrangler.toml"
cp wrangler.example.toml "${BACKUP_DIR}/meta/wrangler.example.toml"
cat > "${BACKUP_DIR}/meta/backup-manifest.json" <<EOF
{
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project": "${ROOT_DIR}",
  "d1Database": "${D1_DATABASE}",
  "kvBinding": "${KV_BINDING}",
  "includes": {
    "d1Sql": "d1/groupware-db.sql",
    "d1Info": "meta/d1-info.json",
    "kvKeys": "kv/kv-keys.json",
    "r2ObjectKeys": "r2/object-keys.json",
    "wranglerToml": "meta/wrangler.toml"
  }
}
EOF
cat > "${BACKUP_DIR}/meta/README.txt" <<EOF
Created at: $(date)
Project: ${ROOT_DIR}
D1 database: ${D1_DATABASE}
KV binding: ${KV_BINDING}

Next suggested commands:
- node scripts/verify-backup.mjs "${BACKUP_DIR}"
- node scripts/backup-kv.mjs "${BACKUP_DIR}"
- node scripts/backup-r2.mjs "${BACKUP_DIR}"
EOF

echo "Base backup complete."
echo "Verify backup:"
echo "  node scripts/verify-backup.mjs \"${BACKUP_DIR}\""
echo "Run this next for full KV values:"
echo "  node scripts/backup-kv.mjs \"${BACKUP_DIR}\""
echo "Run this next for R2 files:"
echo "  node scripts/backup-r2.mjs \"${BACKUP_DIR}\""
