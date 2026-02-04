#!/bin/bash
# System cron wrapper for sync-skills
# Schedule: Every 4 hours (0 */4 * * *)

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

SCRIPT="/Users/steve/clawd/personal-scripts/sync-skills.sh"
OPENCLAW="/Users/steve/Library/pnpm/openclaw"

# Run the actual script
OUTPUT=$("$SCRIPT" 2>&1) || true

# Send via agent using message tool
if [ -n "$OUTPUT" ]; then
    "$OPENCLAW" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve:

$OUTPUT" 2>&1
else
    "$OPENCLAW" agent --agent main --message "Use the message tool to send this to Telegram chat 1191367022 via account steve:

✅ sync-skills completed (no output)" 2>&1
fi
