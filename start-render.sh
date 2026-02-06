#!/usr/bin/env bash
set -euo pipefail

# Render provides $PORT (you set it to 8080)
: "${PORT:=8080}"

# Bind to all interfaces so Render can detect it
# Use your token env var for non-loopback binds
exec openclaw gateway \
  --bind lan \
  --port "$PORT" \
  --token "${OPENCLAW_GATEWAY_TOKEN:-}"
