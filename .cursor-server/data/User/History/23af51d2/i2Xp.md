---
name: Session Management Optimization
overview: Configure Clawdbot's session management with daily resets, auto-compaction, and memory flush to prevent stale data issues and optimize context usage.
todos:
  - id: backup
    content: Backup current clawdbot.json before changes
    status: completed
  - id: session-reset
    content: Configure session.reset with daily mode at 4 AM + 240min idle
    status: completed
  - id: auto-compact
    content: Change compaction.mode from safeguard to auto
    status: completed
  - id: verify-flush
    content: Verify memoryFlush is enabled with softThresholdTokens
    status: completed
  - id: restart
    content: Restart gateway and verify status
    status: completed
  - id: validate
    content: Run validation tests (doctor, sessions list, /status)
    status: in_progress
isProject: false
---

# Session Management Optimization Plan

## Document Control

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | READY |
| **Created** | 2026-01-25 |
| **APEX Compliance** | Full |

---

## Problem Statement

Liam's sessions accumulate stale context over time, leading to:
- Reporting outdated information (e.g., GOG auth issue)
- Context bloat increasing token costs
- Manual intervention required to clear sessions

## Solution Overview

Implement the recommended three-layer memory architecture with:
1. **Daily session reset** at 4 AM + 4-hour idle timeout
2. **Auto-compaction** instead of safeguard mode
3. **Pre-compaction memory flush** (verify enabled)
4. **Memory search** with hybrid mode

---

## Current State Analysis

**Current config (`~/.clawdbot/clawdbot.json`):**
- `compaction.mode`: "safeguard" (warns only, doesn't auto-compact)
- `session.reset`: NOT CONFIGURED (no auto-reset)
- `memorySearch`: Configured with Ollama embeddings

**Risk:** Sessions grow indefinitely until manually cleared.

---

## Implementation Steps

### Phase 1: Backup Current Config

```bash
cp ~/.clawdbot/clawdbot.json ~/.clawdbot/clawdbot.json.backup.session-mgmt
```

### Phase 2: Configure Session Reset

Add daily reset + idle timeout:

```json
{
  "session": {
    "dmScope": "main",
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 240
    }
  }
}
```

**Commands:**
```bash
pnpm run clawdbot config set session.reset.mode daily
pnpm run clawdbot config set session.reset.atHour 4
pnpm run clawdbot config set session.reset.idleMinutes 240
```

### Phase 3: Enable Auto-Compaction

Change from safeguard to auto:

```bash
pnpm run clawdbot config set agents.defaults.compaction.mode auto
```

### Phase 4: Verify Memory Flush

Ensure pre-compaction flush is enabled (should be default):

```bash
pnpm run clawdbot config get agents.defaults.compaction.memoryFlush
```

If not enabled:
```bash
pnpm run clawdbot config set agents.defaults.compaction.memoryFlush.enabled true
pnpm run clawdbot config set agents.defaults.compaction.memoryFlush.softThresholdTokens 4000
```

### Phase 5: Restart Gateway

```bash
systemctl --user restart clawdbot-gateway.service
```

---

## Validation Tests

| Test | Command | Expected |
|------|---------|----------|
| Config applied | `grep -A5 '"session"' ~/.clawdbot/clawdbot.json` | Shows reset config |
| Gateway running | `systemctl --user status clawdbot-gateway` | active (running) |
| Session list | `pnpm run clawdbot sessions list` | Shows sessions |
| Doctor check | `pnpm run clawdbot doctor` | No critical errors |

### Manual Validation

1. Send `/status` to Liam via Telegram
2. Verify response shows session info
3. After 4 AM (or `/new`), verify fresh session created

---

## Rollback Procedure

If issues occur:

```bash
cp ~/.clawdbot/clawdbot.json.backup.session-mgmt ~/.clawdbot/clawdbot.json
systemctl --user restart clawdbot-gateway.service
```

---

## Success Criteria

- [ ] Daily reset configured at 4 AM
- [ ] Idle timeout set to 240 minutes
- [ ] Auto-compaction enabled
- [ ] Memory flush enabled
- [ ] Gateway restarts successfully
- [ ] Liam responds to `/status` correctly
- [ ] No doctor warnings related to sessions

---

## Notes

- Daily reset uses gateway host timezone (PST)
- Sessions in progress are NOT interrupted mid-conversation
- Reset only triggers on NEXT message after the boundary
- Memory files (`memory/*.md`, `MEMORY.md`) are NEVER deleted by reset
