---
name: APEX GOG Audit Fix
overview: Comprehensive APEX Comorbidity Protocol audit of GOG/PATH issues - fixing ALL related bugs found through systematic analysis.
todos:
  - id: fix-stale-memory
    content: "CRITICAL: Update clawd/memory/2026-01-25.md to remove stale gog not found entries"
    status: pending
  - id: fix-stale-plan
    content: "CRITICAL: Update clawd/self-improvement-plan.md to mark gog as fixed"
    status: pending
  - id: configure-gmail-hooks
    content: "CRITICAL: Add hooks section to clawdbot.json for gmail-watcher"
    status: pending
  - id: fix-status-models
    content: "HIGH: Update STATUS.md model table (Gemma 3 -> glm-4.7-flash, etc.)"
    status: pending
  - id: fix-status-cron
    content: "HIGH: Fix STATUS.md cron model references (glm-4.7-flashx is invalid)"
    status: pending
  - id: add-tools-exec
    content: "MEDIUM: Add tools.exec.pathPrepend to ensure .local/bin always in PATH"
    status: pending
  - id: restart-verify
    content: Restart gateway and verify gmail-watcher starts with gog
    status: pending
  - id: run-health-check
    content: Run health-check.sh to verify all fixes
    status: pending
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

### Search Performed

- Searched: All files in clawd/ for "gog.*not found" patterns
- Scope: Memory files, status files, config files, scripts
- Method: grep, file reads, process environment checks, service status

## Findings Table

| Issue | Location | Severity | Status |

|-------|----------|----------|--------|

| Stale "gog not found" in memory | `clawd/memory/2026-01-25.md:5-9` | CRITICAL | Pending fix |

| Stale "gog" issue in plan | `clawd/self-improvement-plan.md:20` | CRITICAL | Pending fix |

| Missing hooks config | `~/.clawdbot/clawdbot.json` | CRITICAL | Pending fix |

| Wrong models in STATUS.md | `clawd/STATUS.md` (Model Strategy table) | HIGH | Pending fix |

| Invalid cron model refs | `clawd/STATUS.md` (Cron Jobs table) | HIGH | Pending fix |

| Missing tools.exec config | `~/.clawdbot/clawdbot.json` | MEDIUM | Pending fix |

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

## Fix Plan

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

### Phase 4: Add tools.exec (MEDIUM)

**File:** `~/.clawdbot/clawdbot.json`

Add to ensure PATH always includes .local/bin:

```json
"tools": {
  "exec": {
    "pathPrepend": ["/home/liam/.local/bin"]
  }
}
```

### Phase 5: Verify

1. Restart gateway: `systemctl --user daemon-reload && systemctl --user restart clawdbot-gateway`
2. Check logs for "gmail watcher started"
3. Run health-check.sh
4. Test gog command via agent

## Prevention Measures

- Gateway restart is required after config changes
- awakening.sh already has explicit PATH export (verified)
- Consider adding config validation to health-check.sh