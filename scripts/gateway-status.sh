#!/usr/bin/env bash
# Check the status of the Clawdbot gateway

set -euo pipefail

if pnpm clawdbot gateway status; then
  PORT=$(pnpm clawdbot config get gateway.port 2>/dev/null | grep -E "^[0-9]+$" | head -1 || echo "18789")
  echo ""
  echo "Control UI URL: http://localhost:${PORT}/"
else
  exit 1
fi
