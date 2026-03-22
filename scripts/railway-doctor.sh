#!/usr/bin/env bash
# Local preflight: catch build failures before you waste another Railway deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== BookClub / Railway doctor ==="
echo ""

echo "→ Node (want >= 20, recommend 22)"
node -v || { echo "  FAIL: node not found"; exit 1; }

echo ""
echo "→ Git remote (sanity)"
git remote -v 2>/dev/null | head -3 || echo "  (no git remote)"

echo ""
echo "→ app/page.tsx exists (fixes wrong '/' on some hosts)"
if [[ -f app/page.tsx ]]; then echo "  OK"; else echo "  MISSING — add root app/page.tsx"; exit 1; fi

echo ""
echo "→ Local production build (same as Docker/Railway image)"
npm ci
npx prisma generate
npm run build
echo "  OK"

echo ""
echo "→ Railway CLI"
if command -v railway &>/dev/null; then
  railway whoami 2>/dev/null || echo "  Run: railway login"
  railway status 2>/dev/null || echo "  Run: railway link (in this directory)"
else
  echo "  Not installed. brew install railway  OR  npm i -g @railway/cli"
fi

echo ""
echo "=== Set these on the WEB service in Railway (dashboard) ==="
echo "  DATABASE_URL     → Reference Postgres (same project + environment)"
echo "  REDIS_URL        → Reference Redis"
echo "  MEILISEARCH_HOST + MEILISEARCH_API_KEY"
echo "  NEXTAUTH_SECRET  → openssl rand -base64 32"
echo "  NEXTAUTH_URL     → https://YOUR-SERVICE.up.railway.app (no trailing slash)"
echo ""
echo "=== What no script can do for you ==="
echo "  Create the Railway project, add Postgres/Redis/Meilisearch, generate domain,"
echo "  and paste secrets — that’s all in the Railway UI once per project."
echo ""
echo "=== Deploy options ==="
echo "  npm run railway:deploy   — git push (if GitHub → Railway connected)"
echo "  npm run railway:up       — railway up from this folder (after railway link)"
echo ""
