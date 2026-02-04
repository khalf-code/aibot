#!/bin/bash
# System cron wrapper for synthesize-memory
# Schedule: Sundays at 6 PM (0 18 * * 0)
# Weekly synthesis of facts into summaries

# Load environment (for API keys)
source ~/.zshenv 2>/dev/null || true

# Ensure gateway is running
source /Users/steve/clawd/personal-scripts/cron-wrappers/ensure-gateway.sh
ensure_gateway

SCRIPT="/Users/steve/clawd/scripts/synthesize-memory.sh"
OPENCLAW="/Users/steve/Library/pnpm/openclaw"

# Run the synthesis script
OUTPUT=$("$SCRIPT" 2>&1)
EXIT_CODE=$?

# Log output
echo "$OUTPUT"

# Notify on completion
if [ $EXIT_CODE -eq 0 ]; then
    "$OPENCLAW" message send --channel telegram --account steve --target 1191367022 \
        --message "🧠 Weekly memory synthesis complete" 2>&1
fi

exit $EXIT_CODE
