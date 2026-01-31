#!/usr/bin/env bash
set -euo pipefail

# Wrapper for the local Glucksberg/issue-prioritizer CLI.
#
# Usage:
#   run.sh <command> <owner/repo> [args...]
#
# Examples:
#   run.sh analyze clawdbot/clawdbot --output markdown
#   run.sh quick-wins clawdbot/clawdbot
#
# Configuration:
#   ISSUE_PRIORITIZER_REPO=/path/to/issue-prioritizer

ISSUE_PRIORITIZER_REPO=${ISSUE_PRIORITIZER_REPO:-/home/dev/agents/issue-prioritizer}
CLI="$ISSUE_PRIORITIZER_REPO/dist/cli.js"

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun not found in PATH" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh (GitHub CLI) not found in PATH" >&2
  exit 1
fi

if [ ! -d "$ISSUE_PRIORITIZER_REPO" ]; then
  echo "error: issue-prioritizer repo not found at: $ISSUE_PRIORITIZER_REPO" >&2
  echo "hint: set ISSUE_PRIORITIZER_REPO=/path/to/Glucksberg/issue-prioritizer" >&2
  exit 1
fi

if [ ! -f "$CLI" ]; then
  echo "error: missing $CLI" >&2
  echo "hint: build it first (may require network):" >&2
  echo "  cd $ISSUE_PRIORITIZER_REPO && bun install && bun run build" >&2
  exit 1
fi

# Prefer to fail fast with a useful hint if gh is not authenticated.
if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh is not authenticated" >&2
  echo "hint: run 'gh auth login' (or configure auth for the environment running this)" >&2
  exit 1
fi

exec bun "$CLI" "$@"
