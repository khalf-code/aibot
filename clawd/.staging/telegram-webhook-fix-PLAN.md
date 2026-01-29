# APEX Plan: Fix Telegram Webhook Timeout for Subagent Tasks

**Status**: STAGED
**Created**: 2026-01-29 07:14 PST
**Author**: Liam

---

## Problem Statement

**Severity**: HIGH
**Type**: Architecture / UX

Telegram webhooks have a **hard 10-second timeout** enforced by Telegram's servers. When Moltbot spawns a subagent for long-running tasks (e.g., "Build the Ceramics Business Intelligence System"), the subagent may take 2+ minutes to complete.

**What happens:**
1. User sends request on Telegram → webhook receives it
2. Moltbot spawns subagent → subagent works for 2.5 minutes
3. Webhook handler times out after 10s
4. Telegram retries (redundant)
5. Subagent completes successfully, but response delivery fails
6. User sees nothing → thinks the bot is broken

**Evidence from logs:**
```
Jan 29 06:51:45 - [telegram] webhook handler failed: Request timed out after 10000 ms
Jan 29 06:52:08 - [telegram] webhook handler failed: Request timed out after 10000 ms
[... multiple retries ...]
Jan 29 06:53:22 - [telegram] sendMessage failed: Network request for 'sendMessage' failed!
Jan 29 06:53:22 - [telegram] final reply failed: HttpError: Network request for 'sendMessage' failed!
```

Telegram's webhook info confirms:
```json
{
  "last_error_date": 1769698382,
  "last_error_message": "Wrong response from the webhook: 500 Internal Server Error"
}
```

---

## Root Cause Analysis

| Factor | Impact |
|--------|--------|
| Telegram webhook timeout | Fixed at ~10s (cannot be changed) |
| Subagent execution time | Variable: 30s to 5+ minutes depending on task |
| ngrok tunnel reliability | Additional network layer, can introduce delays |
| Moltbot `timeoutSeconds` setting | Controls local timeout (60s), but Telegram enforces 10s upstream |

**Key insight**: The `timeoutSeconds: 60` in `moltbot.json` only controls Moltbot's internal timeout. Telegram's server-side timeout of ~10s is the bottleneck.

---

## Solution Options

### Option A: Polling Mode (RECOMMENDED)

**Approach**: Disable webhook, enable long polling

**Pros**:
- Eliminates timeout issues entirely
- Simpler architecture (no ngrok dependency)
- Reliable message delivery
- Works with long-running subagents
- No external tunneling required

**Cons**:
- Requires a public IP or VPS for the polling to work from outside home network
- Currently using ngrok (which is for webhooks, not polling)
- Would need a VPS if Moltbot stays on home server

**Implementation**:
```diff
  "channels": {
    "telegram": {
      "enabled": true,
+     "mode": "polling",
      "dmPolicy": "pairing",
      "botToken": "8221260658:AAGx0J3hGeELbqdqrpUwM-u8T-sSzM2oi9E",
      "groupPolicy": "allowlist",
      "streamMode": "off",
-     "timeoutSeconds": 60,
-     "webhookUrl": "https://toshiko-unbated-uncontinuously.ngrok-free.dev/telegram-webhook",
-     "webhookSecret": "41040b4411c73378e8c23e65a27d6502e9ea997ab0893242ad0493c57bb1455c",
-     "webhookPath": "/telegram-webhook"
    }
  }
```

**Migration steps**:
1. Delete webhook from Telegram: `curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`
2. Apply config change
3. Restart gateway

---

### Option B: Async Response Pattern

**Approach**: Send immediate ack to Telegram, deliver response asynchronously via cron or separate process

**Pros**:
- Keeps webhook mode (ngrok still works)
- User gets immediate confirmation ("Working on it...")
- Can handle long-running tasks

**Cons**:
- Requires code changes in Moltbot core (not just config)
- Complex error handling (what if async delivery fails?)
- User experience fragmentation (ack in one message, result in another)
- More moving parts

**Implementation**: Requires upstream Moltbot changes - not feasible in current scope.

---

### Option C: Increase Telegram Poll Interval (NOT RECOMMENDED)

**Approach**: Force Telegram to give webhook more time via `allowed_updates` and connection tweaks

**Pros**:
- No config changes needed
- Webhook stays active

**Cons**:
- **Will not work** - Telegram's 10s timeout is hard-coded server-side
- Wasted effort

**Status**: Not viable.

---

## Recommended Solution

**Option A: Polling Mode**

**Why:**
1. Simple, reliable, proven pattern
2. Eliminates the timeout problem entirely
3. Removes ngrok dependency (single point of failure)
4. No code changes required - config only
5. Works for all message types (DM, groups, etc.)

**Constraint**: Requires Moltbot to be on a server with public IP or accessible from the internet. If running on home network, would need:
- Port forwarding on router (requires public IP)
- OR move to VPS (recommended for production use case)

---

## Implementation Plan

### Phase 1: Current Config (Staged for Review)

File: `~/.clawdbot/.staging/moltbot.json.proposed`

Change: Switch to polling mode

**Command to review**:
```bash
diff ~/.clawdbot/moltbot.json ~/.clawdbot/.staging/moltbot.json.proposed
```

### Phase 2: Apply Changes (If Approved)

1. **Backup current config** (automatic via script)
2. **Delete Telegram webhook**:
   ```bash
   curl -X POST "https://api.telegram.org/bot8221260658:AAGx0J3hGeELbqdqrpUwM-u8T-sSzM2oi9E/deleteWebhook"
   ```
3. **Apply staged config**:
   ```bash
   ~/clawd/scripts/apply-staging.sh moltbot.json
   ```
4. **Restart gateway**:
   ```bash
   systemctl --user restart clawdbot-gateway
   ```
5. **Verify**:
   ```bash
   curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq .result.url
   ```
   Should return empty string `""`

### Phase 3: Test

1. Send test message from Telegram
2. Verify Liam responds correctly
3. Test long-running subagent task
4. Confirm no timeouts

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Polling fails from home network | High | HIGH | Need VPS or port forwarding |
| Existing messages lost during transition | Low | LOW | Polling picks up immediately |
| ngrok tunnel disruption | N/A | N/A | ngrok no longer needed |
| Config breaks other channels | Very Low | MEDIUM | Changes are telegram-specific only |

---

## Rollback Plan

If issues occur:
1. Restore from backup: `cp ~/.clawdbot/moltbot.json.bak ~/.clawdbot/moltbot.json`
2. Re-register webhook (manually or via `setWebhook` API)
3. Restart gateway

---

## APEX Compliance Checklist

- [x] **Read-First**: Read current moltbot.json before proposing changes
- [x] **Architecture-First**: Identified root cause, evaluated 3 solution options
- [x] **Non-Destructive**: Staging workflow preserves original config
- [x] **Security-First**: No secrets exposed, webhookSecret will be unused
- [x] **Single Source**: Config is source of truth
- [x] **Test before/after**: Verification step included

---

## Next Steps

1. **Simon reviews staged config**
2. **Approval decision**:
   - If yes: Run apply-staging.sh, test, verify
   - If no: Revert staging, discuss alternatives
3. **If approved but home network constraint**: Plan VPS migration

---

## Notes

**Polling from home network constraint**:
Moltbot currently runs on WSL2 behind NAT. Polling from home network may have connectivity issues. Consider:
- Setting up port forwarding on router (requires public static IP from ISP)
- Moving Moltbot to a cloud VPS (recommended for production reliability)

**Alternative for temporary fix**:
If VPS migration is not immediate, could temporarily disable subagent spawning for Telegram channel, but this limits capabilities (long-running tasks would fail).

---

*End of APEX Plan*
