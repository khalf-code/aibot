---
name: Liam System Audit Results
overview: Deep audit of the Liam system revealing multiple inconsistencies between STATUS.md claims and actual system state, including broken services incorrectly marked as "OK", a search skill with wrong API endpoint, and stale/incorrect memory entries.
todos:
  - id: fix-search-endpoint
    content: Fix Z.AI search skill endpoint from open.z.ai to api.z.ai/api/coding/paas/v4
    status: pending
  - id: update-status-md
    content: Update STATUS.md to reflect actual system state (Browser, Calendar, Blogwatcher all broken)
    status: pending
  - id: enable-calendar-api
    content: Enable Google Calendar API in project 1091316374889
    status: pending
  - id: optional-install-go
    content: (Optional) Install Go compiler if blogwatcher is needed
    status: pending
isProject: false
---

# Liam System Deep Audit - Findings

## Executive Summary

The audit reveals **significant inconsistencies** between documented status and actual system state. Liam has been reporting issues that may not exist while simultaneously having broken capabilities marked as "OK". The most critical finding is that **web search through the Z.AI skill is broken due to a wrong API endpoint**, even though Z.AI's API is actually working.

---

## Verified Working Systems

| Component | Status | Evidence |
|-----------|--------|----------|
| **GOG (Gmail)** | WORKING | `gog auth list --check` returns valid auth, expires 2026-01-25 |
| **Gateway** | WORKING | Active 6+ hours, PID 45572, 586MB memory |
| **Ollama Models** | WORKING | 5 models loaded (nomic-embed-text, glm-4.7-flash, lfm2.5-thinking, qwen3-vl, deepseek-ocr) |
| **Z.AI API** | WORKING | Direct curl to `api.z.ai/api/coding/paas/v4` returns valid response |
| **Kroko Voice** | WORKING | Service active 9+ hours on port 6006, warm-up completed |
| **Memory Search** | WORKING | Ollama embeddings configured |

---

## Critical Issues Found

### 1. Z.AI Search Skill - WRONG API ENDPOINT (BUG)

**File:** `/home/liam/clawdbot/skills/zai-search/search.sh`

**Problem:** Script uses `open.z.ai` which doesn't resolve in WSL2 DNS

```bash
# BROKEN (line 26):
curl -s -X POST "https://open.z.ai/api/paas/v4/chat/completions"

# SHOULD BE:
curl -s -X POST "https://api.z.ai/api/coding/paas/v4/chat/completions"
```

**Evidence:**
- `curl open.z.ai` returns "Could not resolve host"
- `curl api.z.ai` returns valid response
- The gateway uses `api.z.ai` which works perfectly

**Impact:** All skill-based web searches silently fail, but Liam reported it as "missing BRAVE_API_KEY" - **wrong diagnosis**.

### 2. STATUS.md Contains False Claims

| Claim in STATUS.md | Actual State | Verdict |
|--------------------|--------------|---------|
| Browser: OK | No browser installed in WSL2 | **FALSE** |
| Calendar: OK | 403 accessNotConfigured error | **FALSE** |
| Blogwatcher: OK | Go not installed, binary missing | **FALSE** |
| Voice Wake: OK | Actually working (verified) | **TRUE** |

### 3. The "Frankenstein GIF" Paradox

Liam claimed it couldn't search because of "missing BRAVE_API_KEY" and "no browser". However:
- The Z.AI API **is working** - it just needed the correct endpoint
- Liam could have used Z.AI's web search capability if the skill script was correct
- The diagnosis was wrong - the actual issue was a bug in the search.sh script

---

## Medium Issues

### 4. Calendar API Not Enabled in Google Cloud

**Error:** `403 accessNotConfigured: Google Calendar API has not been used in project 1091316374889`

**Fix:** Enable Calendar API at: `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1091316374889`

### 5. Missing System Tools

| Tool | Status | Required For |
|------|--------|--------------|
| Go compiler | Not installed | Blogwatcher |
| Chrome/Chromium | Not installed in WSL2 | Browser automation |
| nslookup/dig | Not installed | DNS debugging |

### 6. Memory Files Report Stale Issues

The memory file [2026-01-25.md](clawd/memory/2026-01-25.md) reports blockers that are partially incorrect:
- Reports "missing BRAVE_API_KEY" - but Z.AI search doesn't need Brave
- Reports browser as blocked - accurate, but no browser was ever installed

---

## APEX Compliance Issues

### Violation: "Verify Before Reporting"

HEARTBEAT.md states: "NEVER report issues from memory files without verification. Run the actual check."

**Evidence of violation:** Liam reported "gog is broken" and "web search blocked" without running verification commands. The actual tools work; the diagnosis was wrong.

### Violation: "Fresh Data Protocol"

AGENTS.md states: "Never trust cached data for system status"

**Evidence:** STATUS.md claims "Browser OK" when no browser exists. This stale data persists.

---

## Recommended Fixes

### Immediate (Fix the bugs)

1. **Fix search.sh endpoint:**
   - Change `open.z.ai` to `api.z.ai/api/coding/paas/v4`
   
2. **Update STATUS.md to reflect reality:**
   - Browser: NOT AVAILABLE (no browser installed in WSL2)
   - Calendar: BLOCKED (API not enabled in Google Cloud)
   - Blogwatcher: BLOCKED (Go not installed)

### Short-term (Enable capabilities)

3. **Enable Google Calendar API** in project 1091316374889

4. **Install Go** if blogwatcher is needed:
   ```bash
   sudo apt install golang-go
   go install github.com/Hyaxia/blogwatcher/cmd/blogwatcher@latest
   ```

### Optional (Browser automation)

5. **Browser options:**
   - Install Chrome in Windows and use node proxy
   - Or accept browser automation is not available in WSL2

---

## Root Cause Analysis

The system has a **data staleness problem**:

1. STATUS.md was written when capabilities were expected to work
2. Actual verification failed but STATUS.md wasn't updated
3. Liam reads STATUS.md and believes capabilities exist
4. When tools fail, Liam reports the wrong root cause (API keys) instead of the actual issue (wrong URL, missing software)

**The fix:** Automated health checks should update STATUS.md, not just report to Slack.
