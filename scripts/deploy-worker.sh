#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

echo "Checking Worker deploy plan..."
npx wrangler deploy --dry-run

echo "Deploying Worker..."
npx wrangler deploy
