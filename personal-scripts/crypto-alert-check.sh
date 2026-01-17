#!/bin/bash
# Run crypto alerts and suppress no-op output.

set -u
set -o pipefail

output=$(
  cd /Users/steve/clawd-opie && uv run skills/crypto-tracker/scripts/crypto.py check-alerts 2>&1
)
status=$?

if [ $status -ne 0 ]; then
  printf '%s\n' "$output" >&2
  exit $status
fi

filtered=$(printf '%s\n' "$output" | sed '/No alerts configured/d; /No alerts triggered/d')
filtered=$(printf '%s\n' "$filtered" | sed '/^[[:space:]]*$/d')

if [ -z "$filtered" ]; then
  exit 0
fi

printf '%s\n' "$filtered"
