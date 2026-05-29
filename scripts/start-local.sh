#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

echo "Serving ${ROOT_DIR} at http://${HOST}:${PORT}"
python3 -m http.server "${PORT}" --bind "${HOST}" --directory "${ROOT_DIR}"
