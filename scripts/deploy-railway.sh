#!/usr/bin/env bash
# Deploy BookClub (Next.js app) to Railway.
#
# Prerequisites:
#   - Railway project created; Postgres (and other plugins) attached; env vars set in Railway.
#   - For CLI deploy: `npm i -g @railway/cli` (or use npx), then `railway login` and `railway link` in this directory.
#
# Usage:
#   ./scripts/deploy-railway.sh              # railway up (upload + deploy linked service)
#   ./scripts/deploy-railway.sh --detach     # same, don’t stream logs (passes through to railway up)
#   ./scripts/deploy-railway.sh --verify     # local prisma generate + next build, then railway up
#   ./scripts/deploy-railway.sh --git-push   # git push current branch → triggers GitHub→Railway if connected
#   ./scripts/deploy-railway.sh --git-push main
#
# GitHub auto-deploy: connect the repo in Railway, set Root Directory to `app`, push to the tracked branch;
#   use --git-push instead of `railway up` so builds run from Git (recommended for teams).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

VERIFY=0
MODE="up"
GIT_BRANCH=""
RAILWAY_EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help) usage 0 ;;
    --verify)
      VERIFY=1
      shift
      ;;
    --git-push)
      MODE="git"
      shift
      GIT_BRANCH="${1:-}"
      break
      ;;
    *)
      RAILWAY_EXTRA+=("$1")
      shift
      ;;
  esac
done

if [[ "$MODE" == "git" ]]; then
  if ! command -v git &>/dev/null; then
    echo "git not found." >&2
    exit 1
  fi
  if [[ -z "$GIT_BRANCH" ]]; then
    GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || true
  fi
  if [[ -z "$GIT_BRANCH" || "$GIT_BRANCH" == "HEAD" ]]; then
    echo "Could not determine branch; run: $0 --git-push <branch>" >&2
    exit 1
  fi
  echo "→ Pushing origin $GIT_BRANCH (Railway will build if the repo is linked)…"
  git push origin "$GIT_BRANCH"
  exit 0
fi

if [[ "$VERIFY" -eq 1 ]]; then
  echo "→ Local verify: prisma generate + next build…"
  npm run railway:build
fi

if ! command -v railway &>/dev/null; then
  echo "Railway CLI not found. Install: https://docs.railway.com/develop/cli" >&2
  echo "  e.g. brew install railway   or   npm i -g @railway/cli" >&2
  exit 1
fi

echo "→ railway up ${RAILWAY_EXTRA[*]:-}…"
exec railway up "${RAILWAY_EXTRA[@]}"
