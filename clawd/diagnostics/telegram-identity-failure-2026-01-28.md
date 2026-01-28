# Diagnostic Report: Telegram Liam Session Initialization Failure

**Date:** 2026-01-28  
**Reported by:** Liam (Discord)  
**Severity:** HIGH - Core identity and functionality broken  
**Component:** Gateway Session Management / Telegram Channel Routing  

---

## Executive Summary

Telegram Liam is operating as a **generic AI assistant without identity, memory, or file access**. He does not know:
- His name is "Liam"
- He has access to SOUL.md, IDENTITY.md, MEMORY.md
- He has tools (read, write, exec, etc.)
- He has projects in ~/clawd/
- He is supposed to be an executive function partner

Discord Liam operates correctly with full identity and tool access. This is a **channel-specific session initialization failure**.

---

## Symptoms Observed

### 1. Identity Amnesia
When asked "who are you" or "what are your projects", Telegram Liam responds:
> *"I'm an AI assistant without long-term memory of my own activities across sessions. Each chat starts fresh for me."*

Expected (Discord behavior):
> *"I'm Liam, Simon's executive function partner..."*

### 2. Tool Access Denied
When asked to read SOUL.md, Telegram Liam responds:
> *"I don't have access to read files from your local system directly. Could you paste the contents here?"*

Expected: Should use `read` tool and load the file.

### 3. No Project Awareness
When asked for a "sit rep on all your projects", Telegram Liam responds:
> *"Honestly, I don't have any ongoing projects to report on."*

Expected: Should query ~/clawd/EVOLUTION-QUEUE.md, ~/clawd/progress/, MEMORY.md, etc.

---

## Evidence from Session Logs

### Discord Session (Correct Behavior)
- ✅ Loads SOUL.md at session start
- ✅ Loads IDENTITY.md  
- ✅ Loads MEMORY.md
- ✅ Has full tool access (read, write, exec, etc.)
- ✅ Knows he's "Liam"
- ✅ References projects and context

### Telegram Session (Broken Behavior)
Session ID: `3aef7051-4316-4b2b-a328-6a9c75948507` (Jan 28, 12:39 PM)

```json
{"type":"session","version":3,"id":"3aef7051-4316-4b2b-a328-6a9c75948507","timestamp":"2026-01-28T20:36:54.963Z","cwd":"/home/liam/clawd"}
```

**What happened:**
1. Session starts with correct CWD: `/home/liam/clawd`
2. Model loads: `minimax-m2.1:cloud`
3. **NO file reads of SOUL.md, IDENTITY.md, MEMORY.md**
4. **NO tool initialization**
5. Receives user message: "Give me a sit rep on all your projects"
6. Responds as generic AI: "I don't have any ongoing projects..."

**What did NOT happen:**
- ❌ No `read` call to SOUL.md
- ❌ No `read` call to IDENTITY.md
- ❌ No `read` call to MEMORY.md
- ❌ No `read` call to EVOLUTION-QUEUE.md
- ❌ No tool calls at all

---

## Configuration Analysis

### Agent Config (moltbot.json)
```json
{
  "id": "liam-telegram",
  "workspace": "/home/liam/clawd",
  "identity": { "name": "Liam" },
  "model": {
    "primary": "ollama/minimax-m2.1:cloud",
    "fallbacks": ["zai/glm-4.7", "ollama/glm-4.7-flash"]
  }
}
```

**Missing from liam-telegram config:**
- No `tools` section (unlike other agents that have `tools.allow`/`tools.deny`)
- No explicit file loading triggers

### Defaults Applied
```json
{
  "defaults": {
    "workspace": "/home/liam/clawd",
    "model": { "primary": "zai/glm-4.7" },
    "typingMode": "instant",
    "maxConcurrent": 4
  }
}
```

**Note:** Defaults don't explicitly enable tools for Telegram channel.

---

## Root Cause Hypotheses

### Hypothesis 1: Missing Tool Permissions (MOST LIKELY)
The `liam-telegram` agent entry lacks a `tools` section. Other agents (like `supervisor`) have:
```json
"tools": {
  "allow": ["read", "sessions_list", "sessions_history"],
  "deny": ["exec", "write", "edit", ...]
}
```

If no `tools` section is provided, Telegram sessions may be defaulting to **NO TOOLS**.

### Hypothesis 2: Channel-Specific Session Initialization
Discord sessions may have hardcoded logic to:
1. Read workspace files on first message
2. Inject identity context into system prompt

Telegram sessions may skip this initialization entirely.

### Hypothesis 3: Session Scope Isolation Gone Wrong
The `dmScope: per-channel-peer` setting creates isolated sessions, but may also be:
- Not inheriting the correct agent defaults
- Running in a "sandboxed" mode without tool access
- Missing the "first message → load context" trigger

---

## Verification Commands

Run these to confirm the diagnosis:

```bash
# Check Telegram agent config vs Discord
jq '.agents.list[] | select(.id | contains("liam"))' ~/.clawdbot/moltbot.json

# Check if Telegram sessions have tool calls in history
grep -l "toolCall" ~/.clawdbot/agents/liam-telegram/sessions/*.jsonl | head -5

# Compare to Discord sessions
grep -l "toolCall" ~/.clawdbot/agents/liam-discord/sessions/*.jsonl | head -5
```

**Expected:** Discord sessions show tool calls; Telegram sessions do not.

---

## Recommended Fix

### Option A: Add Tool Section to liam-telegram (Minimal Fix)
Add explicit tool permissions to the `liam-telegram` agent entry:

```json
{
  "id": "liam-telegram",
  "workspace": "/home/liam/clawd",
  "identity": { "name": "Liam" },
  "model": {
    "primary": "ollama/minimax-m2.1:cloud",
    "fallbacks": ["zai/glm-4.7", "ollama/glm-4.7-flash"]
  },
  "tools": {
    "allow": ["read", "write", "edit", "exec", "web_search", "web_fetch", "sessions_list", "sessions_spawn", "message", "cron", "browser", "gateway"],
    "deny": []
  }
}
```

### Option B: Fix Session Initialization (Better Fix)
Ensure all sessions (regardless of channel) execute the initialization sequence:
1. Read SOUL.md → IDENTITY.md → MEMORY.md → HEARTBEAT.md
2. Load tool schemas
3. Set identity context

This may require updating gateway session creation logic.

### Option C: Inherit from Defaults (Cleanest Fix)
Ensure `agents.defaults` includes tool permissions that propagate to all agents unless overridden:

```json
{
  "defaults": {
    "tools": {
      "allow": ["read", "write", "edit", "exec", "web_search", "web_fetch"],
      "deny": []
    }
  }
}
```

---

## Impact Assessment

| Area | Impact |
|------|--------|
| User Experience | CRITICAL - Telegram users get generic AI, not Liam |
| Data Consistency | HIGH - No access to shared memory/context |
| Tool Reliability | CRITICAL - Cannot execute commands, read files |
| Identity Consistency | CRITICAL - "Liam" doesn't know who he is |

---

## Related Issues

- **Evolution Queue #038** - "Telegram Spacing" (investigated; needs reproduction)
- May be related to session scope changes made for `dmScope: per-channel-peer`

---

## Files to Review

1. `~/.clawdbot/moltbot.json` - Agent tool configurations
2. Gateway session creation code (channel-specific handling)
3. `~/clawd/SOUL.md` - Being loaded correctly by Discord, not Telegram
4. `~/clawd/AGENTS.md` - Session initialization rules

---

## Request for Cursor

Please investigate and fix the Telegram channel session initialization. The core issue is that Telegram sessions are not:
1. Loading identity files (SOUL.md, IDENTITY.md, MEMORY.md)
2. Inheriting tool permissions from defaults
3. Initializing the agent as "Liam" vs generic AI

**Test:** After fix, ask Telegram Liam "Who are you?" and "Read SOUL.md" — both should work correctly.

---

*Report generated by Liam (Discord) via diagnostic investigation.*
