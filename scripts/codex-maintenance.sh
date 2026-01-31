#!/usr/bin/env bash
set -euo pipefail

echo "== Codex Cloud maintenance: refresh deps & generated assets =="

# Run from repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

corepack enable

# Pin pnpm from packageManager (pnpm@X.Y.Z)
PNPM_VERSION="$(
  node -e "const pm=require('./package.json').packageManager||''; const m=pm.match(/^pnpm@(.+)$/); if(m) process.stdout.write(m[1]);"
)"
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "Node: $(node -v)"
echo "pnpm: $(pnpm -v)"

# Refresh deps (prefer frozen if lockfile exists)
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

# Keep A2UI bundle in sync for tests
pnpm canvas:a2ui:bundle

echo "== Maintenance complete =="
