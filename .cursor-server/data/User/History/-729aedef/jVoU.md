---
name: Comprehensive Staleness Prevention
overview: "Expand staleness prevention beyond status reports to cover all functionality that depends on fresh data: context cues, progress tracking, heartbeat deduplication, and proactive monitoring."
todos:
  - id: agents-fresh-data
    content: Add comprehensive Fresh Data Protocol section to AGENTS.md
    status: completed
  - id: heartbeat-dedup
    content: Add heartbeat state freshness and context cue rules to HEARTBEAT.md
    status: in_progress
  - id: progress-warning
    content: Add cache warning to progress/README.md
    status: pending
  - id: disable-cache
    content: Optionally disable session store cache via environment variable
    status: pending
isProject: false
---

# Comprehensive Staleness Prevention

## Problem Scope

The current staleness fix only covers status reports. Multiple other systems depend on fresh data:

**Affected Systems:**
- Context Cue System (PARA task queries)
- Progress Tracking (multi-step task continuity)
- Heartbeat Deduplication (timestamp-based checks)
- Proactive Monitoring (blogwatcher, weather)
- Health Checks (gateway, models, services)

**Root Causes:**
1. Session context caches file reads for conversation duration
2. `sessions.json` has 45-second in-memory cache
3. `lastHeartbeatText` persists stale heartbeat responses
4. Memory files treated as current state
5. No explicit "re-read before use" rules for most systems

## Solution: Fresh Data Protocol

### 1. Add Fresh Data Protocol to AGENTS.md

Create a comprehensive section covering ALL stale data scenarios:

```markdown
## Fresh Data Protocol (CRITICAL)

### Rule: Verify Before Acting

Never trust cached data for:
- System status (always re-read STATUS.md)
- Active tasks (always query para.sqlite fresh)
- Progress files (always read before continuing)
- Heartbeat timestamps (always check file mtime)
- Any "current state" information

### Data Freshness by Type

| Data Type | Cache Risk | Verification |
|-----------|------------|--------------|
| STATUS.md | High | Re-read every time |
| para.sqlite | Medium | Fresh query each context cue |
| progress/*.txt | High | Re-read at iteration start |
| memory/*.json | High | Check mtime, re-read if changed |
| lastHeartbeatText | Critical | NEVER use - always verify |

### Session Context Warning

Files you read during this conversation are cached in your context.
If the file may have changed, READ IT AGAIN - don't use memory.

This applies especially to:
- Progress files (other processes may update)
- Status files (may be fixed since you read)
- Config files (may be changed via Cursor)
```

**File:** [clawd/AGENTS.md](clawd/AGENTS.md)

### 2. Enhance HEARTBEAT.md with Deduplication Rules

Add explicit rules for timestamp-based deduplication:

```markdown
### Heartbeat State Freshness

Before using timestamps from `memory/*-heartbeat-state.json`:
1. Read the file fresh (don't use cached version)
2. Check if timestamp is reasonable (not in future, not ancient)
3. If file is missing or corrupt, treat all checks as "never done"

**Stale timestamp symptoms:**
- Duplicate alerts (timestamp not updated after check)
- Missed checks (timestamp artificially in future)
```

**File:** [clawd/HEARTBEAT.md](clawd/HEARTBEAT.md)

### 3. Add Freshness Warning to Progress Tracking

Update progress README with cache warning:

```markdown
## CRITICAL: Always Read Fresh

Before continuing ANY progress file:
1. READ the file again - even if you just read it
2. Check for updates from other processes/sessions
3. Never continue work based on "I remember" the progress

Progress files are updated by multiple sessions. Your cached version may be stale.
```

**File:** [clawd/progress/README.md](clawd/progress/README.md)

### 4. Disable Session Store Cache (Optional)

Add environment variable to disable 45-second session cache:

```bash
# In ~/.clawdbot/credentials/liam.env
export CLAWDBOT_SESSION_CACHE_TTL_MS=0
```

**Tradeoff:** Slightly slower session operations, but guaranteed fresh data.

### 5. Add Context Cue Freshness Rule

Add to HEARTBEAT.md context cue section:

```markdown
### Context Cue Freshness

When generating context cues:
1. Query para.sqlite directly (not from memory)
2. Check calendar with fresh gog command
3. Never say "I remember you were working on X"
```

## Implementation Order

1. Update AGENTS.md with comprehensive Fresh Data Protocol
2. Enhance HEARTBEAT.md with deduplication and context cue rules
3. Update progress/README.md with cache warning
4. Optionally set `CLAWDBOT_SESSION_CACHE_TTL_MS=0`
