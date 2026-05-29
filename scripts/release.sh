#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/Desktop/groupware-backups}"
BACKUP_DIR="${BACKUP_DIR:-$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)-release}"

cd "${ROOT_DIR}"

echo "== Groupware release workflow =="
echo "Project: ${ROOT_DIR}"

echo ""
echo "== 1. Preflight =="
node scripts/preflight-check.mjs

if [[ "${RELEASE_BACKUP:-0}" == "1" ]]; then
  echo ""
  echo "== 2. Backup =="
  echo "Backup directory: ${BACKUP_DIR}"
  BACKUP_DIR="${BACKUP_DIR}" scripts/backup-data.sh
  node scripts/verify-backup.mjs "${BACKUP_DIR}"

  if [[ "${RELEASE_BACKUP_KV:-0}" == "1" ]]; then
    node scripts/backup-kv.mjs "${BACKUP_DIR}"
  else
    echo "Skipping full KV value backup. Set RELEASE_BACKUP_KV=1 to enable."
  fi

  if [[ "${RELEASE_BACKUP_R2:-0}" == "1" ]]; then
    node scripts/backup-r2.mjs "${BACKUP_DIR}"
  else
    echo "Skipping R2 file backup. Set RELEASE_BACKUP_R2=1 to enable."
  fi
else
  echo ""
  echo "== 2. Backup skipped =="
  echo "Set RELEASE_BACKUP=1 to create a backup before deploy."
fi

if [[ "${RELEASE_DEPLOY:-0}" == "1" ]]; then
  echo ""
  echo "== 3. Deploy =="
  if [[ "${CONFIRM_DEPLOY:-}" != "YES" ]]; then
    echo "Set CONFIRM_DEPLOY=YES to deploy the Worker."
    exit 1
  fi
  scripts/deploy-worker.sh
else
  echo ""
  echo "== 3. Deploy skipped =="
  echo "Set RELEASE_DEPLOY=1 CONFIRM_DEPLOY=YES to deploy."
fi

if [[ "${RELEASE_SMOKE:-0}" == "1" ]]; then
  echo ""
  echo "== 4. Smoke test =="
  node scripts/smoke-test.mjs
else
  echo ""
  echo "== 4. Smoke test skipped =="
  echo "Set RELEASE_SMOKE=1 to run smoke tests."
fi

echo ""
echo "Release workflow complete."
