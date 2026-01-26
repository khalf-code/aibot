---
name: Clawdbot Update Audit
overview: Successfully updated Clawdbot from v2026.1.24-0 to v2026.1.25, restored all identity files, fixed Telegram truncation, and performed full APEX audit.
todos:
  - id: test-telegram
    content: Test Telegram to verify truncation is fixed - send message to @Liam_C_Bot
    status: pending
  - id: monitor-24h
    content: Monitor system for 24 hours for any issues
    status: pending
isProject: false
---

# Clawdbot v2026.1.25 Update and APEX Audit Report

## Update Summary

**Before:** v2026.1.24-0
**After:** v2026.1.25

The update was performed by resetting to upstream/main and carefully restoring all local customizations.

## Identity Files Restored

All of Liam's identity files in `/home/liam/clawd/` were restored:
- `SOUL.md` - Core identity
- `STATUS.md` - System status (updated to reflect v2026.1.25)
- `IDENTITY.md` - Identity details
- `AGENTS.md` - Agent configuration  
- `JOB.md` - Job description
- `HEARTBEAT.md` - Proactive monitoring
- `MEMORY.md` - Memory system
- `EVOLUTION-QUEUE.md` - Improvement proposals
- Plus all supporting files and the `memory/`, `plans/` directories

## Custom Skills Preserved

- `zai-search/` - Fixed Z.AI search skill (uses correct `api.z.ai` endpoint)
- `opportunity-lifecycle/` - Custom opportunity tracking skill
- `inventory/` - Inventory management
- `kroko-voice/` - Voice wake integration
- `sherpa-onnx-tts/` - TTS skill

## Telegram Truncation Fix

**Issue:** Messages were being truncated when Liam responded
**Root Cause:** `streamMode: "partial"` was causing incomplete message delivery
**Fix Applied:** Changed `channels.telegram.streamMode` from `"partial"` to `"off"`

The gateway was restarted with this fix applied. Telegram should now send complete messages.

## New Capabilities in v2026.1.25

From the changelog, key new features:
- **WebChat:** Image paste support and image-only sends
- **Sub-agents:** Announce replies now visible in Web UI
- **Sessions:** Merge preferring newest entries

From v2026.1.24:
- **Telegram:** DM topics as separate sessions, outbound link preview toggle
- **Exec approvals:** In-chat `/approve` across all channels
- **TTS:** Edge fallback (keyless) + `/tts` auto modes
- **Web search:** Brave freshness filter for time-scoped results
- **UI:** Refreshed Control UI dashboard design system
- **Gateway:** Config.patch for safe partial updates

## APEX Audit Results

### Doctor Check: PASSED
- Gateway: Running on port 18789
- Telegram: OK (@Liam_C_Bot)
- Agent: main (default)
- Heartbeat: 30m interval
- Skills: 8/49 ready
- Plugins: 3 loaded, 0 errors

### Security Audit: 2 WARN, 1 INFO

| Severity | Issue | Status |
|----------|-------|--------|
| WARN | gateway.trusted_proxies_missing | Expected (loopback only) |
| WARN | fs.credentials_dir.perms_readable | **FIXED** - chmod 700 applied |
| INFO | Attack surface summary | groups: 0 open, 2 allowlist |

### Verified Working

- Telegram channel: OK
- Gateway service: Running v2026.1.25
- Z.AI Search skill: Using correct endpoint
- All identity files: Intact
- Memory/plans directories: Restored
- Google Workspace APIs: All enabled

## Remaining Items

From the previous remediation plan:
- `add-upstream-remote`: **COMPLETED** - upstream remote added
- `voice-call-setup`: On hold per user request

## Recommendations

1. **Test Telegram**: Send a message to @Liam_C_Bot to verify full messages are received
2. **Monitor**: Watch for any issues over the next day
3. **Git cleanup**: Consider committing the current state to preserve customizations