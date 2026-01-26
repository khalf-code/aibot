---
name: Restore Broken Config
overview: The clawdbot.json file lost important configuration sections during debugging. Memory search, skills, and subagent tool restrictions were removed and need to be restored.
todos:
  - id: restore-memory-search
    content: Restore memorySearch configuration section to clawdbot.json
    status: in_progress
  - id: restore-skills
    content: Restore skills configuration section with blogwatcher, skill-creator, summarize, weather, session-logs, model-usage
    status: pending
  - id: restore-subagent-tools
    content: Restore tools.subagents section with deny list for cron/gateway
    status: pending
  - id: restart-verify
    content: Restart gateway and verify all functionality restored
    status: pending
isProject: false
---

# Restore Broken clawdbot.json Configuration

## Problem Found

During the Z.AI debugging session, [.clawdbot/clawdbot.json](.clawdbot/clawdbot.json) lost several important sections:

### Missing Configurations

1. **memorySearch** - Ollama embedding configuration for memory/semantic search
```json
"memorySearch": {
  "provider": "openai",
  "model": "nomic-embed-text",
  "remote": {
    "baseUrl": "http://172.26.0.1:11434/v1",
    "apiKey": "ollama"
  },
  "sync": { "onSearch": true, "watch": true }
}
```

2. **skills** - Bundled skill configurations
```json
"skills": {
  "entries": {
    "blogwatcher": { "enabled": true, "config": {...} },
    "skill-creator": { "enabled": true },
    "summarize": { "enabled": true },
    "weather": { "enabled": true },
    "session-logs": { "enabled": true },
    "model-usage": { "enabled": true }
  }
}
```

3. **tools.subagents** - Subagent tool restrictions (deny cron/gateway)
```json
"tools": {
  "subagents": {
    "tools": { "deny": ["cron", "gateway"] }
  }
}
```

4. **subagents.archiveAfterMinutes** - Was set to 60

### What's Still Working

- GOG access: Confirmed working (`gog auth list` shows clawdbot@puenteworks.com authenticated)
- Z.AI model: Now uses built-in provider correctly
- Gateway service: Running with correct PATH including `/home/liam/.local/bin` (where `gog` lives)

### Other Uncommitted Changes (Safe)

These changes from the APEX audit are beneficial and should be kept:
- [clawd/MEMORY.md](clawd/MEMORY.md) - Updated macOS paths to Linux
- [gog-reference.md](gog-reference.md) - Updated macOS paths to Linux  
- Skill scripts - Use env vars instead of hardcoded macOS paths
- instagram-intelligence - Changed simon@ to clawdbot@ email

## The Fix

Restore the missing sections to [.clawdbot/clawdbot.json](.clawdbot/clawdbot.json) from the committed version while keeping the corrected model references.
