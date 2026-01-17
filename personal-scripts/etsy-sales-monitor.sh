#!/bin/bash
# Run Etsy sales monitor and suppress no-op output.

set -u
set -o pipefail

output=$(
  cd /Users/steve/clawd && python3 personal-scripts/etsy-sales-monitor.py 2>&1
)
status=$?

if [ $status -ne 0 ]; then
  printf '%s\n' "$output" >&2
  exit $status
fi

filtered=$(printf '%s\n' "$output" | sed '/^HEARTBEAT_OK$/d')
filtered=$(printf '%s\n' "$filtered" | sed '/^[[:space:]]*$/d')

if [ -z "$filtered" ]; then
  exit 0
fi

printf '%s\n' "$filtered"
