#!/usr/bin/env bash
set -euo pipefail

# Force OpenClaw to use /data as HOME
export HOME=/data

: "${OPENCLAW_CONFIG_PATH:=${HOME}/.clawdbot/openclaw.json}"

# Create directories
mkdir -p /data/.clawdbot /data/workspace 2>/dev/null || true

# Run the entrypoint command
exec "$@"
