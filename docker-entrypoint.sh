#!/bin/sh
set -eu
cd /app
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Cloud Run must point at Cloud SQL." >&2
  exit 1
fi
export PORT="${PORT:-8080}"
exec npx next start --hostname 0.0.0.0 --port "$PORT"
