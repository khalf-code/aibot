#!/bin/bash
# Liam Health Check Script
# Run manually or via cron to verify system health

FIX=false
REPORT=false
for arg in "$@"; do
    if [ "$arg" == "--fix" ]; then FIX=true; fi
    if [ "$arg" == "--report" ]; then REPORT=true; fi
done

EXIT_CODE=0
OUTPUT=""

run_check() {
    local msg="$1"
    echo "$msg"
    OUTPUT+="$msg\n"
}

# Capture output if reporting
if [ "$REPORT" = true ]; then
    # Redirect stdout to a temporary file while also capturing it for the report
    exec 3>&1
    exec > >(tee -a /tmp/liam-health.log)
fi

echo "=== Liam Health Check ==="
echo "Date: $(date)"
echo ""

# 1. Gateway status
run_check "## Gateway Status"
cd "/home/liam/clawdbot"
STATUS=$(pnpm run clawdbot gateway status 2>&1)
GW_RUNNING=$(echo "$STATUS" | grep -E "(running|Runtime|Listening)")
run_check "$GW_RUNNING"
if echo "$STATUS" | grep -q "stopped"; then
    run_check "CRITICAL: Gateway is stopped!"
    EXIT_CODE=1
    if [ "$FIX" = true ]; then
        run_check "Attempting to start gateway..."
        pnpm run clawdbot gateway start
    fi
fi
echo ""

# 2. Recent errors
run_check "## Recent Errors (last 5)"
if command -v journalctl >/dev/null 2>&1; then
    ERRORS=$(journalctl --user -u clawdbot-gateway -n 50 | grep -i "error" | tail -5)
    if [ -n "$ERRORS" ]; then
        run_check "$ERRORS"
    else
        run_check "No errors found in journal"
    fi
else
    run_check "journalctl not found"
fi
echo ""

# 3. Email account check
run_check "## Email Configuration"
if grep -q "clawdbot@puenteworks.com" ~/.profile; then
    run_check "Email account: OK (clawdbot@puenteworks.com)"
else
    run_check "WARNING: Email account may be misconfigured in ~/.profile!"
    [ $EXIT_CODE -eq 0 ] && EXIT_CODE=2
fi
echo ""

# 4. Protected files permissions
run_check "## File Permissions"
for file in ~/clawd/SOUL.md ~/clawd/IDENTITY.md ~/clawd/STATUS.md ~/clawd/AGENTS.md; do
    if [ -f "$file" ]; then
        perms=$(ls -la "$file" | awk '{print $1}')
        if [[ "$perms" == *"r--r--r--"* ]]; then
            run_check "$(basename $file): LOCKED (read-only)"
        else
            run_check "$(basename $file): UNLOCKED - should be chmod 444!"
            [ $EXIT_CODE -eq 0 ] && EXIT_CODE=2
            if [ "$FIX" = true ]; then
                run_check "Locking $file..."
                chmod 444 "$file"
            fi
        fi
    fi
done
echo ""

# 5. Kroko Voice Service
run_check "## Kroko Voice Status"
KROKO_STATUS=$(systemctl --user is-active kroko-voice.service 2>/dev/null)
if [ "$KROKO_STATUS" == "active" ] || [ "$KROKO_STATUS" == "activating" ]; then
    run_check "Kroko.AI: OK ($KROKO_STATUS)"
else
    run_check "WARNING: Kroko.AI service is ${KROKO_STATUS:-inactive}!"
    [ $EXIT_CODE -eq 0 ] && EXIT_CODE=2
fi
echo ""

# 6. GOG Check
run_check "## GOG Status"
if command -v gog >/dev/null 2>&1; then
    # Use environment password if available, fallback to ~/.profile search
    GOG_PWD="${GOG_KEYRING_PASSWORD}"
    if [ -z "$GOG_PWD" ]; then
        GOG_PWD=$(grep "export GOG_KEYRING_PASSWORD=" ~/.profile | cut -d'"' -f2)
    fi
    
    GOG_AUTH=$(export GOG_KEYRING_PASSWORD="$GOG_PWD" && gog auth list --check 2>&1)
    if echo "$GOG_AUTH" | grep -q "true"; then
        run_check "GOG: OK (Authorized)"
    else
        run_check "CRITICAL: GOG Authorization failed!"
        run_check "$GOG_AUTH"
        EXIT_CODE=1
    fi
else
    run_check "CRITICAL: gog command not found!"
    EXIT_CODE=1
fi
echo ""

# 7. Cron jobs count
run_check "## Cron Jobs"
job_count=$(grep -c '"id"' ~/.clawdbot/cron/jobs.json 2>/dev/null || echo "0")
run_check "Active jobs: $job_count"
echo ""

run_check "=== Health Check Complete (Exit: $EXIT_CODE) ==="

if [ "$REPORT" = true ]; then
    # Send report to Simon via Slack
    cd "/home/liam/clawdbot"
    REPORT_HEADER="🌅 **Liam has awakened.** System self-check results:"
    if [ $EXIT_CODE -eq 0 ]; then
        SUMMARY="✅ All systems nominal."
    else
        SUMMARY="⚠️ Issues detected during awakening (Exit $EXIT_CODE)."
    fi
    
    FINAL_MESSAGE="$REPORT_HEADER\n\n$SUMMARY\n\n\`\`\`\n$(echo -e "$OUTPUT" | head -c 3000)\n\`\`\`"
    
    # Retry up to 3 times
    for attempt in 1 2 3; do
        if pnpm run clawdbot message send --message "$FINAL_MESSAGE" --channel slack --target "user:U09UU9ZG49G" 2>/dev/null; then
            echo "Slack notification sent (attempt $attempt)"
            break
        fi
        echo "Slack send failed (attempt $attempt), retrying in 10s..."
        sleep 10
    done
    
    # Fallback: Always write to local log
    echo -e "$(date): $FINAL_MESSAGE" >> ~/clawd/awakening.log
fi

exit $EXIT_CODE
