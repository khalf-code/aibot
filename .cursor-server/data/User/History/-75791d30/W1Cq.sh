#!/bin/bash
# Liam Awakening Script - Handles all edge cases for post-reboot startup
set -o pipefail

LOG="/home/liam/clawd/awakening.log"
MAX_NETWORK_WAIT=60
MAX_GATEWAY_WAIT=30

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

log "=== AWAKENING SEQUENCE STARTED ==="

# 1. Source environment
export PATH="/home/liam/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export GOG_KEYRING_BACKEND="file"
export GOG_KEYRING_PASSWORD="FXCfzyDH/SbRpemXl54gV47coLO3uJBV"
export GOG_ACCOUNT="clawdbot@puenteworks.com"
log "Environment loaded"

# 2. Wait for network
log "Waiting for network..."
NETWORK_OK=false
for i in $(seq 1 $MAX_NETWORK_WAIT); do
    if ping -c 1 8.8.8.8 &>/dev/null; then
        log "Network ready after ${i}s"
        NETWORK_OK=true
        break
    fi
    sleep 1
done
if [ "$NETWORK_OK" = false ]; then
    log "WARNING: Network timeout after ${MAX_NETWORK_WAIT}s - continuing anyway"
fi

# 3. Ensure systemd user services are running
log "Starting systemd user services..."
systemctl --user daemon-reload
systemctl --user start clawdbot-gateway.service
systemctl --user start kroko-voice.service

# 4. Wait for gateway to be ready (listening on port)
log "Waiting for gateway to be ready..."
GATEWAY_OK=false
for i in $(seq 1 $MAX_GATEWAY_WAIT); do
    if ss -tunlp | grep -q ":18789"; then
        log "Gateway ready after ${i}s"
        GATEWAY_OK=true
        break
    fi
    sleep 1
done
if [ "$GATEWAY_OK" = false ]; then
    log "ERROR: Gateway not ready after ${MAX_GATEWAY_WAIT}s"
fi

# 5. Run health check with fixes and reporting
log "Running health check..."
cd /home/liam/clawd
bash health-check.sh --report --fix 2>&1 | tee -a "$LOG"

log "=== AWAKENING SEQUENCE COMPLETE ==="
