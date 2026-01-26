#!/usr/bin/env bash
# Start the Clawdbot gateway

set -euo pipefail

echo "Starting Clawdbot gateway..."

# Check if gateway is already running
if lsof -iTCP:18789 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✓ Gateway is already running on port 18789"
  PORT=$(pnpm clawdbot config get gateway.port 2>/dev/null | grep -E "^[0-9]+$" | head -1 || echo "18789")
  echo ""
  echo "Access the Control UI at:"
  echo "  http://localhost:${PORT}/"
  exit 0
fi

# Try to start via service
START_OUTPUT=$(pnpm clawdbot gateway start 2>&1)
START_EXIT=$?

if [ $START_EXIT -eq 0 ]; then
  echo "Gateway start command completed."
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
    echo "✓ Gateway is running and listening on port ${PORT}!"
    echo ""
    echo "Access the Control UI at:"
    echo "  http://localhost:${PORT}/"
    echo ""
    echo "If the UI doesn't load in your browser:"
    echo "  1. Ensure Control UI assets are built: pnpm ui:build"
    echo "  2. Check gateway logs: ./scripts/clawlog.sh"
    echo "  3. Verify gateway status: ./scripts/gateway-status.sh"
  else
    echo "⚠ Gateway start command succeeded, but gateway is not listening on port ${PORT}."
    echo ""
    echo "The gateway service may need to be installed or there may be a startup error."
    echo "Try:"
    echo "  1. Install service: pnpm clawdbot gateway install"
    echo "  2. Or run directly (foreground): pnpm clawdbot gateway run"
    echo "  3. Check logs: ./scripts/clawlog.sh"
    echo "  4. Check service status: ./scripts/gateway-status.sh"
    exit 1
  fi
elif echo "$START_OUTPUT" | grep -q "service not loaded\|not installed"; then
  echo "Gateway service not installed. Installing..."
  if pnpm clawdbot gateway install 2>&1; then
    echo "Gateway service installed. Starting..."
    if pnpm clawdbot gateway start 2>&1; then
      echo "Gateway start command completed."
      echo "Waiting for gateway to be ready..."
      PORT=$(pnpm clawdbot config get gateway.port 2>/dev/null | grep -E "^[0-9]+$" | head -1 || echo "18789")
      GATEWAY_READY=false
      sleep 2
      for i in {1..28}; do
        sleep 1
        if lsof -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
          GATEWAY_READY=true
          break
        fi
      done
      
      if [ "$GATEWAY_READY" = true ]; then
        echo "✓ Gateway is running and listening on port ${PORT}!"
        echo ""
        echo "Access the Control UI at:"
        echo "  http://localhost:${PORT}/"
      else
        echo "⚠ Gateway start command succeeded, but gateway is not listening on port ${PORT}."
        echo "Check logs: ./scripts/clawlog.sh"
        exit 1
      fi
    else
      EXIT_CODE=$?
      echo "✗ Gateway start failed after install (exit code: $EXIT_CODE)."
      echo ""
      echo "Troubleshooting:"
      echo "  1. Check service status: ./scripts/gateway-status.sh"
      echo "  2. Run directly (foreground): pnpm clawdbot gateway run"
      echo "  3. Check logs: ./scripts/clawlog.sh"
      exit $EXIT_CODE
    fi
  else
    echo "✗ Gateway service installation failed."
    exit 1
  fi
else
  EXIT_CODE=$START_EXIT
  echo "✗ Gateway start failed (exit code: $EXIT_CODE)."
  echo ""
  echo "Output:"
  echo "$START_OUTPUT"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check service status: ./scripts/gateway-status.sh"
  echo "  2. Install service: pnpm clawdbot gateway install"
  echo "  3. Run directly (foreground): pnpm clawdbot gateway run"
  echo "  4. Check logs: ./scripts/clawlog.sh"
  exit $EXIT_CODE
fi
