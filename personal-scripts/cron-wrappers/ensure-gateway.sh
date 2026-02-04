#!/bin/bash
# Ensure gateway is running before sending notifications

OPENCLAW="/Users/steve/Library/pnpm/openclaw"

ensure_gateway() {
    # Check if gateway is reachable
    if ! lsof -i :18789 >/dev/null 2>&1; then
        echo "Gateway not running, starting daemon..."
        "$OPENCLAW" daemon start >/dev/null 2>&1
        sleep 5
    fi
}
