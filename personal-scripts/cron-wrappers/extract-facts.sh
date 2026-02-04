#!/bin/bash
# System cron wrapper for extract-facts
# Schedule: Every 30 minutes (*/30 * * * *)
# Extracts durable facts from conversations and syncs to ppl.gift

# Load environment (for API keys)
source ~/.zshenv 2>/dev/null || true

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

SCRIPT="/Users/steve/clawd/scripts/extract-facts.sh"
OPENCLAW="/Users/steve/Library/pnpm/openclaw"

# Run the extraction script
OUTPUT=$("$SCRIPT" 2>&1)
EXIT_CODE=$?

# Log output
echo "$OUTPUT"

# If facts were extracted and synced, optionally notify (disabled by default)
# FACT_COUNT=$(echo "$OUTPUT" | grep -oP 'Extracted \K\d+' | tail -1)
# if [ "${FACT_COUNT:-0}" -gt 0 ]; then
#     "$OPENCLAW" message send --channel telegram --account steve --target 1191367022 \
#         --message "📝 Extracted $FACT_COUNT facts → ppl.gift" 2>&1
# fi

exit $EXIT_CODE
