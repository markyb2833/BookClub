#!/usr/bin/env bash
# One entry point for Railway-related commands.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

cmd="${1:-help}"
shift || true

case "$cmd" in
  doctor)
    bash scripts/railway-doctor.sh
    ;;
  verify)
    npm run railway:build
    ;;
  push | deploy)
    bash scripts/deploy-railway.sh --git-push "$@"
    ;;
  up)
    bash scripts/deploy-railway.sh "$@"
    ;;
  help | -h | --help)
    cat <<'EOF'
Usage: bash scripts/railway.sh <command>

  doctor   Run local checks + full npm ci + next build (catch errors before deploy)
  verify   prisma generate + next build only (faster)
  push     git push current branch → GitHub → Railway (if repo connected)
  up       railway up (requires: railway login + railway link in this directory)

Why this isn’t “one click fixes Railway”:
  The platform still needs you to create services, reference DATABASE_URL, and set
  NEXTAUTH_* once. Scripts only verify code builds and trigger deploy.

Docker:
  railway.toml uses Dockerfile by default for reproducible Node 22 builds.
EOF
    ;;
  *)
    echo "Unknown command: $cmd — run: bash scripts/railway.sh help" >&2
    exit 1
    ;;
esac
