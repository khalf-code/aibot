---
name: APEX GOG Audit Fix
overview: Comprehensive APEX Comorbidity Protocol audit of GOG/PATH issues - fixing ALL related bugs AND the underlying architectural issue where Liam reports stale memory as current state.
todos:
  - id: fix-architecture
    content: "CRITICAL: Add VERIFY-BEFORE-REPORTING rule to HEARTBEAT.md and memory file format"
    status: completed
  - id: fix-stale-memory
    content: "CRITICAL: Update clawd/memory/2026-01-25.md with RESOLVED markers and verification"
    status: completed
  - id: fix-stale-plan
    content: "CRITICAL: Update clawd/self-improvement-plan.md to mark gog as RESOLVED"
    status: completed
  - id: configure-gmail-hooks
    content: "CRITICAL: Add hooks section to clawdbot.json for gmail-watcher"
    status: completed
  - id: fix-status-models
    content: "HIGH: Update STATUS.md model table (Gemma 3 -> glm-4.7-flash, etc.)"
    status: completed
  - id: fix-status-cron
    content: "HIGH: Fix STATUS.md cron model references (glm-4.7-flashx is invalid)"
    status: completed
  - id: add-tools-exec
    content: "MEDIUM: Add tools.exec.pathPrepend to ensure .local/bin always in PATH"
    status: completed
  - id: add-timezone-config
    content: "MEDIUM: Explicitly set userTimezone in clawdbot.json (don't rely on system fallback)"
    status: completed
  - id: restart-verify
    content: Restart gateway and verify gmail-watcher starts with gog
    status: completed
  - id: run-health-check
    content: Run health-check.sh to verify all fixes
    status: in_progress
isProject: false
---

# APEX Comorbidity Audit: GOG "Not Installed" Recurring Issue

## Comorbidity Analysis (Following APEX Protocol)

### Original Bug

**What:** GOG repeatedly reported as "not installed" during sitrep/status checks

**Where:** Agent responses, health checks, heartbeat

**Symptom:** User keeps seeing "gog command not found" despite gog being installed

### Bug Classification

**Category:** State/Configuration (Environment not propagating + Stale cached data)

### Comorbidity Reasoning

This bug type statistically accompanies:

1. **Stale data in multiple locations** - If one status file is wrong, others likely are too
2. **Missing configuration sections** - If hooks aren't configured, other optional configs may be missing
3. **Service restart requirements** - Config changes need service restarts to take effect
4. **Cross-reference inconsistencies** - Documentation may not match actual state
5. **ARCHITECTURAL: Memory-as-truth confusion** - Agent reads historical logs and reports them as current state (THIS IS THE ROOT CAUSE)

### Search Performed

- Searched: All files in clawd/ for "gog.*not found" patterns
- Scope: Memory files, status files, config files, scripts
- Method: grep, file reads, process environment checks, service status

## Findings Table

| Issue | Location | Severity | Status |

|-------|----------|----------|--------|

| **No verify-before-report rule** | `clawd/HEARTBEAT.md` | **CRITICAL (ROOT)** | Pending fix |

| Stale "gog not found" in memory | `clawd/memory/2026-01-25.md:5-9` | CRITICAL | Pending fix |

| Stale "gog" issue in plan | `clawd/self-improvement-plan.md:20` | CRITICAL | Pending fix |

| Missing hooks config | `~/.clawdbot/clawdbot.json` | CRITICAL | Pending fix |

| Wrong models in STATUS.md | `clawd/STATUS.md` (Model Strategy table) | HIGH | Pending fix |

| Invalid cron model refs | `clawd/STATUS.md` (Cron Jobs table) | HIGH | Pending fix |

| Missing tools.exec config | `~/.clawdbot/clawdbot.json` | MEDIUM | Pending fix |

| Missing explicit timezone | `~/.clawdbot/clawdbot.json` | MEDIUM | Pending fix |

| blogwatcher not found | Gateway logs 12:00:58 | LOW | Note only |

## Verified Working (No Fix Needed)

| Component | Status | Evidence |

|-----------|--------|----------|

| gog binary | OK | `/home/liam/.local/bin/gog` exists, executable |

| gog auth | OK | `gog auth list --check` returns true for clawdbot@puenteworks.com |

| Gateway PATH | OK | Process env shows `/home/liam/.local/bin` in PATH |

| Gateway GOG env vars | OK | GOG_KEYRING_BACKEND, GOG_KEYRING_PASSWORD, GOG_ACCOUNT all set |

| All services running | OK | clawdbot-gateway, kroko-voice, liam-awakens all active |

| Skill directories | OK | zai-vision, zai-search, inventory, social-media, gog all exist |

| Actual Ollama models | OK | glm-4.7-flash, lfm2.5-thinking, qwen3-vl, deepseek-ocr, nomic-embed-text |

| Temporal grounding | OK | Clawdbot passes current date/time to agent in system prompt |

| System timezone | OK | America/Los_Angeles (correct for Simon)

## Fix Plan

### Phase 0: Fix Architectural Issue (CRITICAL - ROOT CAUSE)

**Problem:** Liam reads daily memory files and reports historical issues as if they're current. Memory files are logs (historical), but Liam can't distinguish "this was true at time X" from "this is true now."

**Solution 1: Update HEARTBEAT.md** - Add "Verify Before Reporting" rule

Add to `clawd/HEARTBEAT.md`:

```markdown
## CRITICAL: Verify Before Reporting

**NEVER report issues from memory files without verification.**

Memory files (`memory/YYYY-MM-DD.md`) are HISTORICAL LOGS, not current state.
Before reporting any issue you read in memory:

1. **Run the actual check** - Don't just quote the memory file
2. **Verify current state** - Use the actual command/tool
3. **If fixed, note it** - Add "[RESOLVED]" marker to memory entry

Example:
- BAD: "Memory says gog is not found" → reports old issue as current
- GOOD: Run `which gog` first → if found, gog is working now
```

**Solution 2: Update Memory File Format** - Add status markers

Daily memory entries about issues should use this format:

```markdown
## HH:MM - Issue/Check

**Status:** [ACTIVE|RESOLVED|INVESTIGATING]
**Verified:** YYYY-MM-DD HH:MM

[Description of issue]

### Resolution (if resolved)
[How it was fixed, when]
```

**Solution 3: Add to health-check.sh** - Live verification, not memory reading

The health check should ALWAYS run actual commands, never just read status files.

(Already implemented correctly - just documenting the principle)

### Phase 1: Fix Stale Data (CRITICAL)

**File 1:** `clawd/memory/2026-01-25.md`

- Remove/update lines 5-9 that say "gog command not found"
- Add entry noting gog was fixed

**File 2:** `clawd/self-improvement-plan.md`

- Update line 20 to mark gog issue as RESOLVED

### Phase 2: Fix Configuration (CRITICAL)

**File:** `~/.clawdbot/clawdbot.json`

Add hooks section:

```json
"hooks": {
  "enabled": true,
  "gmail": {
    "account": "clawdbot@puenteworks.com"
  }
}
```

### Phase 3: Fix Documentation (HIGH)

**File:** `clawd/STATUS.md`

Update Model Strategy table from:

```
| Gemma 3 4B | Ollama (local) | Fast |
| Qwen 2.5 7B | Ollama (local) | Medium |
```

To:

```
| GLM-4.7-Flash | Ollama (local) | Fast/Flash |
| LFM-2.5-Thinking | Ollama (local) | Reasoning |
| Qwen3-VL 4B | Ollama (local) | Vision |
| DeepSeek OCR | Ollama (local) | OCR |
```

Update Cron Jobs table:

- Change `zai/glm-4.7-flashx` to `zai/glm-4.7` (flashx is invalid)

### Phase 4: Add tools.exec and timezone config (MEDIUM)

**File:** `~/.clawdbot/clawdbot.json`

Add to ensure PATH always includes .local/bin:

```json
"tools": {
  "exec": {
    "pathPrepend": ["/home/liam/.local/bin"]
  }
}
```

Add explicit timezone config (don't rely on system fallback):

```json
"agents": {
  "defaults": {
    "userTimezone": "America/Los_Angeles",
    "timeFormat": "12"
  }
}
```

**Why:** Clawdbot already passes current date/time to agents in the system prompt, but explicit config ensures reliability across reboots/migrations.

### Phase 5: Verify

1. Restart gateway: `systemctl --user daemon-reload && systemctl --user restart clawdbot-gateway`
2. Check logs for "gmail watcher started"
3. Run health-check.sh
4. Test gog command via agent

## Prevention Measures

### Architectural (Most Important)

- **Memory files are logs, not truth** - Always verify before reporting
- **HEARTBEAT.md now has "Verify Before Reporting" rule** - Liam must run actual checks
- **Issue entries should have status markers** - [ACTIVE], [RESOLVED], [INVESTIGATING]
- **STATUS.md is source of truth** - But must be kept updated by Cursor (protected file)

### Operational

- Gateway restart is required after config changes
- awakening.sh already has explicit PATH export (verified)
- health-check.sh runs actual commands (not memory reads)