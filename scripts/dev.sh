#!/usr/bin/env bash
set -e

# Always run from the Next.js app root (where prisma/schema.prisma lives),
# even if this script is invoked from another cwd.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "🗄  Running database migrations..."
npx prisma migrate dev

echo "✅ Starting app and worker..."
exec npx concurrently \
  --names "next,worker" \
  --prefix-colors "cyan,magenta" \
  "next dev" \
  "tsx watch worker/index.ts"
