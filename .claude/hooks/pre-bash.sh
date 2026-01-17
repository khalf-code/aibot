#!/bin/bash
# Pre-bash hook: Validate commands before execution
# Reads command from stdin as JSON

set -e

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command being run
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Block dangerous patterns
# Allow read-only git operations: stash list/show, branch -a, log, status, diff
if echo "$COMMAND" | grep -qE '(rm -rf /|git push.*--force|git checkout|git switch)'; then
  echo '{"decision": "block", "reason": "Command blocked by pre-bash hook: potentially dangerous operation"}' >&2
  exit 2
fi

# Block mutating stash operations (but allow list/show/drop)
if echo "$COMMAND" | grep -qE 'git stash' && ! echo "$COMMAND" | grep -qE 'git stash (list|show|drop)'; then
  echo '{"decision": "block", "reason": "Command blocked by pre-bash hook: git stash mutations not allowed (use list/show/drop only)"}' >&2
  exit 2
fi

# Allow the command to proceed
exit 0
