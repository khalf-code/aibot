#!/usr/bin/env bash
set -euo pipefail

echo "== Codex Cloud setup: DAISy-Agency =="

# Ensure we're in repo root even if script is run from elsewhere
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
echo "Repo: $(pwd)"

# Use Corepack + pnpm version pinned by package.json "packageManager"
corepack enable

# Read pnpm version from package.json packageManager (expects pnpm@X.Y.Z)
PNPM_VERSION="$(
  node -e "const pm=require('./package.json').packageManager||''; const m=pm.match(/^pnpm@(.+)$/); if(m) process.stdout.write(m[1]);"
)"
echo "Using pnpm@$PNPM_VERSION"
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "Node: $(node -v)"
echo "pnpm: $(pnpm -v)"

# Install deps (prefer reproducible installs if lockfile exists)
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

# Prebuild A2UI bundle (prevents canvas-host 503 in tests)
pnpm canvas:a2ui:bundle

echo "== Setup complete =="
