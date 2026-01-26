---
name: Fix Stale GOG Status
overview: Multiple memory files still contain outdated information stating GOG is a blocker. These need to be updated to reflect that GOG is now working.
todos:
  - id: fix-heartbeat-rule
    content: Update HEARTBEAT.md to cover ALL memory/ files, not just YYYY-MM-DD.md pattern
    status: completed
  - id: archive-session-log
    content: Move memory/session-log.md to memory/archive/2026-01-24-session-log.md
    status: completed
  - id: fix-self-improvement
    content: Update clawd/self-improvement-plan.md to check GOG fix box and update SUCCESS METRICS table
    status: in_progress
isProject: false
---

# Fix Stale GOG Blocker Status in Memory Files

## Root Cause

The HEARTBEAT.md "Verify Before Reporting" rule is too narrow:

```
Memory files (`memory/YYYY-MM-DD.md`) are HISTORICAL LOGS
```

This only applies to dated files like `2026-01-25.md`, but NOT to `session-log.md` - so Liam treats it as a "current session" document rather than a historical log from January 24.

## Problem

Liam keeps reporting GOG as a blocker because several memory files contain outdated information:

### Files with Stale GOG Status

1. **[clawd/memory/session-log.md](clawd/memory/session-log.md)** - Most critical

   - Says: `**Recommendation**: Start with gog OAuth setup to enable full proactive monitoring. This is the final blocker before I can do any Gmail/Calendar/email work.`
   - Section "⚠️ Blocked" lists: `Gmail/Calendar monitoring — waiting for gog OAuth setup`

2. **[clawd/self-improvement-plan.md](clawd/self-improvement-plan.md)**

   - Has unchecked box: `- [ ] Fix gog command access`
   - SUCCESS METRICS table shows: `| Email polling | ❌ Broken |`
   - SUCCESS METRICS table shows: `| Calendar access | ❌ Broken |`

### Already Correct Files

- [clawd/memory/2026-01-25.md](clawd/memory/2026-01-25.md) - Shows GOG as `[RESOLVED]` at 12:30 PST
- [clawd/STATUS.md](clawd/STATUS.md) - Shows GOG skill as `OK`
- [clawd/HEARTBEAT.md](clawd/HEARTBEAT.md) - Has the "Verify Before Reporting" rule

## The Fix

### 1. Fix HEARTBEAT.md rule (root cause)

Update the rule to cover ALL files in `memory/`, not just `YYYY-MM-DD.md`:

```markdown
Memory files (everything in `memory/`) are HISTORICAL LOGS, not current state.
```

### 2. Archive session-log.md

Move `memory/session-log.md` to `memory/archive/2026-01-24-session-log.md` - it's a historical session from Jan 24 that shouldn't be in the active memory path where Liam looks for "current" info.

### 3. Update self-improvement-plan.md

- Check the box: `- [x] Fix gog command access`
- Update SUCCESS METRICS table: Email polling and Calendar access from `❌ Broken` to `✅ Working`

## Verification

After updates:

- HEARTBEAT.md rule covers all memory files
- session-log.md archived (not in active memory path)
- No files report GOG as blocker
- `gog auth list` shows authenticated