#!/bin/bash
# Run Otter transcript list and suppress empty output.

set -u
set -o pipefail

output=$(
  cd /Users/steve/clawd && uv run skills/otter/scripts/otter.py list --since 24h 2>&1
)
status=$?

if [ $status -ne 0 ]; then
  printf '%s\n' "$output" >&2
  exit $status
fi

filtered=$(printf '%s\n' "$output" | sed '/^[[:space:]]*$/d')

if [ -z "$filtered" ]; then
  exit 0
fi

printf '%s\n' "$filtered"
