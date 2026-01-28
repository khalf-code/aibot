#!/usr/bin/env bash
# Liam Self-Audit Script v1.0
# Run: daily at 8 AM, after builds, or manually
# Usage: ./self-audit.sh [--quick|--full|--post-change]

set -euo pipefail
CLAWD_DIR="/home/liam/clawd"
CLAWDBOT_DIR="/home/liam/clawdbot"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

CRITICAL=0; HIGH=0; MEDIUM=0; LOW=0

log_critical() { echo -e "${RED}[CRITICAL]${NC} $1"; CRITICAL=$((CRITICAL + 1)); }
log_high() { echo -e "${RED}[HIGH]${NC} $1"; HIGH=$((HIGH + 1)); }
log_medium() { echo -e "${YELLOW}[MEDIUM]${NC} $1"; MEDIUM=$((MEDIUM + 1)); }
log_low() { echo -e "${YELLOW}[LOW]${NC} $1"; LOW=$((LOW + 1)); }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }

MODE="${1:---full}"

echo "=========================================="
echo "Liam Self-Audit - $(date '+%Y-%m-%d %H:%M')"
echo "Mode: $MODE"
echo "=========================================="

# === 1. DOCUMENTATION CHECKS ===
echo -e "\n--- 1. Documentation ---"

# SOUL.md size (CRITICAL - causes context truncation)
SOUL_SIZE=$(wc -c < "$CLAWD_DIR/SOUL.md")
if [ "$SOUL_SIZE" -gt 20000 ]; then
    log_critical "SOUL.md is $SOUL_SIZE chars (limit: 20000) - WILL CAUSE CONTEXT TRUNCATION"
elif [ "$SOUL_SIZE" -gt 18000 ]; then
    log_medium "SOUL.md is $SOUL_SIZE chars (approaching 20000 limit)"
else
    log_ok "SOUL.md size: $SOUL_SIZE chars"
fi

# APEX version consistency
if grep -rqE "APEX v[0-9]\.[0-9]" "$CLAWD_DIR"/*.md 2>/dev/null; then
    STALE=$(grep -rn "APEX v[0-9]" "$CLAWD_DIR"/*.md 2>/dev/null | grep -vE "v6\.2\.0|upgraded from|backup|EVOLUTION-QUEUE" | head -3 || true)
    if [ -n "$STALE" ]; then
        log_high "Stale APEX version refs found"
    else
        log_ok "APEX versions consistent"
    fi
fi

# === 2. SYSTEM HEALTH ===
if [ "$MODE" != "--quick" ]; then
    echo -e "\n--- 2. System Health ---"
    
    # Gateway
    if npm exec --prefix /home/liam -- clawdbot channels status 2>&1 | grep -q "Gateway reachable"; then
        log_ok "Gateway reachable"
    else
        log_critical "Gateway NOT reachable"
    fi
    
    # Ollama
    if curl -sf http://172.26.0.1:11434/api/tags >/dev/null 2>&1; then
        log_ok "Ollama responding"
    else
        log_critical "Ollama NOT responding"
    fi
    
    # GOG auth
    if gog auth list --check 2>&1 | grep -q "true"; then
        log_ok "GOG auth valid"
    else
        log_high "GOG auth invalid/expired"
    fi
    
    # Memory search
    if npm exec --prefix /home/liam -- clawdbot memory search "test" --agent liam-telegram 2>&1 | grep -qE "^[0-9]\.[0-9]"; then
        log_ok "Memory search working"
    else
        log_high "Memory search failing"
    fi
fi

# === 3. STATUS.MD STALENESS ===
echo -e "\n--- 3. STATUS.md Staleness ---"

# Gmail-Poll check
if grep -q "Gmail-Poll.*ACTIVE" "$CLAWD_DIR/STATUS.md" 2>/dev/null; then
    if ! npm exec --prefix /home/liam -- clawdbot cron list 2>&1 | grep -q "Gmail-Poll"; then
        log_high "STATUS.md says Gmail-Poll ACTIVE but it's disabled/removed"
    fi
fi

# Weekly vs Daily Employee Review
if grep -q "Weekly-Employee-Review" "$CLAWD_DIR/STATUS.md" 2>/dev/null; then
    if npm exec --prefix /home/liam -- clawdbot cron list 2>&1 | grep -q "Daily-Employee-Review"; then
        log_medium "STATUS.md says Weekly but cron shows Daily-Employee-Review"
    fi
fi

# === 4. QUEUE INTEGRITY ===
echo -e "\n--- 4. Queue Integrity ---"

# Ghost bug: Entry 036
if grep -q "### \[2026-01-27-036\]" "$CLAWD_DIR/EVOLUTION-QUEUE.md" 2>/dev/null; then
    if ! grep -q "036.*RESOLVED" "$CLAWD_DIR/EVOLUTION-QUEUE.md"; then
        if grep -q "Session Health Check" "$CLAWD_DIR/HEARTBEAT.md"; then
            log_medium "Entry 036 is ghost bug - Session Health already in HEARTBEAT.md"
        fi
    fi
fi

# Ghost bug: Entry 037
if grep -q "### \[2026-01-27-037\]" "$CLAWD_DIR/EVOLUTION-QUEUE.md" 2>/dev/null; then
    if ! grep -q "037.*RESOLVED" "$CLAWD_DIR/EVOLUTION-QUEUE.md"; then
        if grep -q "Create without discovering" "$CLAWD_DIR/apex-vault/APEX_COMPACT.md"; then
            log_medium "Entry 037 is ghost bug - find/ls already in APEX"
        fi
    fi
fi

# === 5. PERMISSIONS ===
echo -e "\n--- 5. Permissions ---"

# SOUL.md should be read-only
SOUL_PERMS=$(stat -c %a "$CLAWD_DIR/SOUL.md" 2>/dev/null || echo "000")
if [ "$SOUL_PERMS" = "444" ]; then
    log_ok "SOUL.md read-only (444)"
else
    log_medium "SOUL.md permissions: $SOUL_PERMS (expected 444)"
fi

# jobs.json should be owner-only
JOBS_PERMS=$(stat -c %a ~/.clawdbot/cron/jobs.json 2>/dev/null || echo "000")
if [ "$JOBS_PERMS" = "600" ]; then
    log_ok "jobs.json secure (600)"
else
    log_low "jobs.json permissions: $JOBS_PERMS (recommended 600)"
fi

# === 6. TOOLS ===
if [ "$MODE" = "--full" ]; then
    echo -e "\n--- 6. Tools ---"
    
    for tool in gog gh blogwatcher; do
        if command -v "$tool" &>/dev/null || [ -f "/home/liam/go-workspace/bin/$tool" ]; then
            log_ok "$tool available"
        else
            log_medium "$tool not found"
        fi
    done
fi

# === SUMMARY ===
echo -e "\n=========================================="
echo "AUDIT SUMMARY"
echo "=========================================="
echo "Critical: $CRITICAL | High: $HIGH | Medium: $MEDIUM | Low: $LOW"

TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW))
if [ $CRITICAL -gt 0 ]; then
    echo -e "\n${RED}ACTION REQUIRED: $CRITICAL critical issue(s)${NC}"
    exit 1
elif [ $HIGH -gt 0 ]; then
    echo -e "\n${YELLOW}WARNING: $HIGH high-priority issue(s)${NC}"
    exit 0
elif [ $TOTAL -eq 0 ]; then
    echo -e "\n${GREEN}All checks passed${NC}"
    exit 0
else
    echo -e "\n${GREEN}Minor issues only${NC}"
    exit 0
fi
