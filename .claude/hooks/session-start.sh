#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web/mobile) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Run async so session starts immediately while deps install in background
echo '{"async": true, "asyncTimeout": 300000}'

cd "$CLAUDE_PROJECT_DIR"

# Install pnpm if not available
if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm@10
fi

# Install dependencies (idempotent, uses cache on subsequent runs)
pnpm install --frozen-lockfile=false

# Build the project so linters with type-awareness work
pnpm build
