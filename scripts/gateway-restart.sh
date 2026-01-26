#!/usr/bin/env bash
# Restart the Clawdbot gateway

set -euo pipefail

echo "Restarting Clawdbot gateway..."
RESTART_OUTPUT=$(pnpm clawdbot gateway restart 2>&1)
RESTART_EXIT=$?

if [ $RESTART_EXIT -eq 0 ] || echo "$RESTART_OUTPUT" | grep -q "not loaded"; then
  # If service is not loaded, try to bootstrap it
  if echo "$RESTART_OUTPUT" | grep -q "not loaded"; then
    echo "Gateway service not loaded. Installing and starting..."
    if pnpm clawdbot gateway install 2>&1; then
      echo "Gateway service installed. Starting..."
      launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.clawdbot.gateway.plist 2>&1 || true
    fi
  fi
  
  echo "Gateway restart command completed."
  echo "Waiting for gateway to be ready..."
  
  # Wait up to 30 seconds for the gateway to start listening
  PORT=$(pnpm clawdbot config get gateway.port 2>/dev/null | grep -E "^[0-9]+$" | head -1 || echo "18789")
  GATEWAY_READY=false
  # Give the service a moment to start
  sleep 2
  for i in {1..28}; do
    sleep 1
    if lsof -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
      GATEWAY_READY=true
      break
    fi
  done
  
  # Verify gateway is actually listening on the port
  if [ "$GATEWAY_READY" = true ]; then
    echo "✓ Gateway restarted and is listening on port ${PORT}!"
    echo ""
    echo "Access the Control UI at:"
    echo "  http://localhost:${PORT}/"
  else
    echo "⚠ Gateway restart command succeeded, but gateway is not listening on port ${PORT}."
    echo ""
    echo "The gateway service may need to be installed or there may be a startup error."
    echo "Try:"
    echo "  1. Install service: pnpm clawdbot gateway install"
    echo "  2. Check logs: ./scripts/clawlog.sh"
    echo "  3. Check service status: ./scripts/gateway-status.sh"
    exit 1
  fi
else
  echo "✗ Gateway restart failed."
  exit 1
fi
