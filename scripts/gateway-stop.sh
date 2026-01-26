#!/usr/bin/env bash
# Stop the Clawdbot gateway

set -euo pipefail

echo "Stopping Clawdbot gateway..."
if pnpm clawdbot gateway stop; then
  echo "✓ Gateway stopped."
else
  echo "✗ Gateway stop failed or gateway was not running."
  exit 1
fi
