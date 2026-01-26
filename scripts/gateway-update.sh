#!/usr/bin/env bash
# Update, rebuild, and restart the Clawdbot gateway
# This script pulls latest changes, rebuilds, and restarts while preserving gateway state/memory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "🔄 Updating Clawdbot gateway..."
echo ""

# Step 1: Check git status
echo "📥 Step 1: Checking git status..."
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "⚠️  You have unstaged changes. Handling them..."
  
  # Check if there are only dist/ changes (build artifacts)
  UNSTAGED=$(git diff --name-only)
  if echo "$UNSTAGED" | grep -q "^dist/" && ! echo "$UNSTAGED" | grep -qv "^dist/"; then
    echo "   Only dist/ changes detected (build artifacts). Restoring them..."
    git restore dist/ 2>/dev/null || true
  else
    # Check for .gitignore changes (common and safe to restore)
    if echo "$UNSTAGED" | grep -q "^\.gitignore$" && [ "$(echo "$UNSTAGED" | wc -l | tr -d ' ')" = "1" ]; then
      echo "   Only .gitignore changes detected. Restoring..."
      git restore .gitignore 2>/dev/null || true
    else
      echo "⚠️  You have unstaged changes that may be important:"
      echo "$UNSTAGED" | sed 's/^/     - /'
      echo ""
      echo "   These changes will be preserved, but you may need to resolve conflicts."
      echo "   Continuing with pull (will attempt rebase)..."
    fi
  fi
fi

# Step 2: Pull latest changes
echo ""
echo "📥 Step 2: Pulling latest changes from git..."

# Store current HEAD before pull to detect changes
PREV_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")

PULL_OUTPUT=$(git pull --rebase 2>&1) || {
  PULL_EXIT=$?
  echo "✗ Git pull failed (exit code: $PULL_EXIT)"
  echo ""
  echo "Output:"
  echo "$PULL_OUTPUT"
  echo ""
  echo "Please resolve any conflicts manually and try again."
  exit $PULL_EXIT
}

# Check if there were any new commits
CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" = "$CURRENT_HEAD" ]; then
  echo "✓ Repository is already up to date"
  NEW_COMMITS=false
else
  echo "✓ Successfully pulled latest changes"
  NEW_COMMITS=true
  # Show what changed
  if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$CURRENT_HEAD" ]; then
    echo ""
    echo "Recent commits:"
    git log --oneline "$PREV_HEAD..HEAD" 2>/dev/null | head -5 | sed 's/^/   /' || git log --oneline -5 | sed 's/^/   /'
  fi
fi

# Step 3: Check if rebuild is needed
echo ""
echo "🔨 Step 3: Checking if rebuild is needed..."

# Count TypeScript source files that changed
if [ "$NEW_COMMITS" = true ] && [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$CURRENT_HEAD" ]; then
  # Compare with previous HEAD before pull
  TS_CHANGES=$(git diff --name-only "$PREV_HEAD" HEAD 2>/dev/null | grep -E '\.(ts|tsx)$|^src/' | wc -l | tr -d ' ' || echo "0")
  
  if [ "$TS_CHANGES" -gt 0 ]; then
    echo "   Found $TS_CHANGES TypeScript source file(s) changed. Rebuild required."
    NEEDS_REBUILD=true
  else
    echo "   No TypeScript source files changed. Checking if dist/ is up to date..."
    # Check if dist exists and is newer than any source file
    if [ -d "dist" ] && [ -f "dist/.buildstamp" ]; then
      NEEDS_REBUILD=false
    else
      NEEDS_REBUILD=true
      echo "   dist/ directory missing or incomplete. Rebuild required."
    fi
  fi
else
  # No new commits, but check if dist/ exists
  if [ ! -d "dist" ] || [ ! -f "dist/.buildstamp" ]; then
    NEEDS_REBUILD=true
    echo "   dist/ directory missing or incomplete. Rebuild required."
  else
    NEEDS_REBUILD=false
    echo "   No new commits and dist/ exists. Skipping rebuild."
  fi
fi

# Step 4: Rebuild if needed
if [ "$NEEDS_REBUILD" = true ]; then
  echo ""
  echo "🔨 Step 4: Rebuilding application..."
  if pnpm build; then
    echo "✓ Build completed successfully"
  else
    BUILD_EXIT=$?
    echo "✗ Build failed (exit code: $BUILD_EXIT)"
    echo ""
    echo "Please fix build errors and try again."
    exit $BUILD_EXIT
  fi
else
  echo ""
  echo "⏭️  Step 4: Skipping rebuild (not needed)"
fi

# Step 5: Restart gateway
echo ""
echo "🔄 Step 5: Restarting gateway..."
echo ""
echo "   Note: Gateway state and memory are preserved during restart."
echo "   Sessions, config, and agent state are stored in ~/.clawdbot/ and persist automatically."
echo ""

# Use the existing restart script (it will print the Control UI URL)
if bash "$SCRIPT_DIR/gateway-restart.sh"; then
  echo ""
  echo "✅ Gateway update complete!"
else
  RESTART_EXIT=$?
  echo ""
  echo "✗ Gateway restart failed (exit code: $RESTART_EXIT)"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check gateway status: ./scripts/gateway-status.sh"
  echo "  2. Check logs: ./scripts/clawlog.sh"
  echo "  3. Try manual restart: ./scripts/gateway-restart.sh"
  exit $RESTART_EXIT
fi
