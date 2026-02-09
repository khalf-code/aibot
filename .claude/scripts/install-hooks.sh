#!/bin/sh
# install-hooks.sh — One-time hook setup
# Usage: bash .claude/scripts/install-hooks.sh

set -e

DIR="$(git rev-parse --show-toplevel)"
cd "$DIR"

echo "[1/3] Installing dependencies..."
pnpm install

echo "[2/3] Installing lefthook hooks..."
npx lefthook install

echo "[3/3] Verifying..."
HOOKS_PATH=$(git config --get core.hooksPath 2>/dev/null || echo "(not set)")
echo "  core.hooksPath = $HOOKS_PATH"

if [ -f "git-hooks/pre-commit" ]; then
  echo "  pre-commit hook: OK"
else
  echo "  pre-commit hook: MISSING"
  exit 1
fi

if [ -f "git-hooks/commit-msg" ]; then
  echo "  commit-msg hook: OK"
else
  echo "  commit-msg hook: MISSING"
  exit 1
fi

echo ""
echo "Done. Hooks installed successfully."
echo "  - pre-commit: lint + changeset-check (parallel)"
echo "  - commit-msg: commitlint"
echo "  - pre-push: test + build (parallel)"
