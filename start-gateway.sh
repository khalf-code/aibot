#!/bin/bash
# Auto-restart wrapper for clawdis gateway
# Usage: ./start-gateway.sh

cd "$(dirname "$0")"

while true; do
  echo "[$(date)] Starting gateway..."
  node dist/index.js gateway
  EXIT_CODE=$?
  echo "[$(date)] Gateway exited with code $EXIT_CODE"

  if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] Clean exit, restarting in 2 seconds..."
    sleep 2
  else
    echo "[$(date)] Error exit, restarting in 5 seconds..."
    sleep 5
  fi
done
