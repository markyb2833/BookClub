#!/usr/bin/env bash
# Railway: run migrations in the same runtime as the app (private DB DNS is reliable here).
# The release phase sometimes fails to reach Postgres (connection errors / deploy loops).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "railway-start: DATABASE_URL is not set — check Variable reference on the web service."
  exit 1
fi

npx prisma migrate deploy
exec npm run start
