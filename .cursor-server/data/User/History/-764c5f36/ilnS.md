---
name: APEX GOG Audit Fix
overview: Comprehensive audit of all GOG/PATH issues following APEX Bug Comorbidity Protocol - fixing the recurring "gog not installed" problem once and for all by addressing all root causes and related issues.
todos:
  - id: verify-gog-state
    content: Verify gog binary works and gateway has correct PATH
    status: pending
  - id: fix-stale-memory
    content: Update memory files and self-improvement plan to reflect gog is working
    status: pending
  - id: configure-gmail-hooks
    content: Add hooks.gmail config to clawdbot.json for full Google Workspace access
    status: pending
  - id: restart-verify
    content: Restart gateway and verify gmail-watcher starts
    status: pending
  - id: add-prevention
    content: Add gog verification to awakening.sh with explicit PATH
    status: pending
isProject: false
---

# APEX Audit: GOG "Not Installed" Recurring Issue

## Root Cause Analysis

The "gog not installed" error keeps recurring because there are **multiple failure points**:

1. **Memory/Status File Cache**: `clawd/memory/2026-01-25.md` contains old entries saying "gog command not found" from 01:09 and 01:26. When Liam reads his memory for context, he sees these old failures.

2. **Gateway Environment**: The gateway process needs to be restarted after PATH changes to pick up new environment variables.

3. **Multiple Check Locations**: GOG is checked in at least 4 places:
   - `clawd/health-check.sh` (line 102-120)
   - `clawd/overnight-builds/cli-library/liam-lib.sh` (line 111)
   - `clawdbot/src/hooks/gmail-watcher.ts` (line 37-38)
   - Agent tools via `hasBinary()` in `src/agents/skills/config.ts`

4. **Hooks Not Configured**: The `hooks.gmail` section is missing from `~/.clawdbot/clawdbot.json`, so gmail-watcher never starts.

5. **Self-Improvement Plan References Old Status**: `clawd/self-improvement-plan.md` line 20 says "gog command not found" as an open issue.

## Comorbid Issues Found

- STATUS.md may contain outdated information about gog availability
- Memory files contain stale failure records
- No automatic verification that PATH changes propagate to running services
- gmail hooks need to be configured for full Google Workspace access

## Fix Plan

### Phase 1: Verify Current State
- Confirm gog binary is executable: `/home/liam/.local/bin/gog`
- Confirm gateway process has correct PATH
- Run gog auth check manually to verify it works

### Phase 2: Fix Stale Data
- Update `clawd/memory/2026-01-25.md` to reflect that gog IS working now
- Update `clawd/self-improvement-plan.md` to mark gog as fixed
- Update `clawd/STATUS.md` if it contains outdated gog info

### Phase 3: Configure Gmail Hooks
Add to `~/.clawdbot/clawdbot.json`:
```json
"hooks": {
  "enabled": true,
  "gmail": {
    "account": "clawdbot@puenteworks.com"
  }
}
```

### Phase 4: Restart Gateway
- Reload systemd daemon
- Restart clawdbot-gateway.service
- Verify gmail-watcher starts successfully

### Phase 5: Verification
- Run health-check.sh and confirm GOG shows OK
- Check logs for "gmail watcher started"
- Have Liam run a test gog command

## Files to Modify

- `~/.clawdbot/clawdbot.json` - Add hooks.gmail config
- `clawd/memory/2026-01-25.md` - Update with fix confirmation
- `clawd/self-improvement-plan.md` - Mark gog issue as resolved
- `clawd/STATUS.md` - Verify/update gog status

## Prevention Measures

- Add gog check to `awakening.sh` with explicit PATH export
- Document that gateway restart is required after PATH changes
