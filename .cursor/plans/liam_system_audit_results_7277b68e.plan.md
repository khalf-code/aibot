---
name: Liam System Audit Results
overview: Comprehensive audit revealing STATUS.md inconsistencies, broken Z.AI search skill, unused Clawdbot capabilities (Perplexity/Firecrawl), and upstream updates available (v2026.1.24).
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
  - id: configure-perplexity
    content: Configure Perplexity/OpenRouter for web search (alternative to Brave API)
    status: pending
  - id: add-upstream-remote
    content: Add upstream git remote and evaluate v2026.1.24 updates
    status: pending
  - id: install-clawdhub
    content: Install clawdhub CLI for skill discovery
    status: pending
isProject: false
---

# Liam System Deep Audit - Findings

## Executive Summary

The audit reveals:

1. **STATUS.md inconsistencies** - Browser, Calendar, Blogwatcher marked "OK" but broken
2. **Z.AI search skill bug** - Wrong API endpoint (`open.z.ai` should be `api.z.ai`)
3. **Unused capabilities** - Perplexity search, Firecrawl, Chrome extension relay not configured
4. **Upstream updates available** - v2026.1.24 released (local fork has no remote)
5. **ClawdHub empty** - No community skills available yet, CLI not installed

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

## Unused Clawdbot Capabilities (High Value)

The official Clawdbot documentation reveals capabilities NOT configured in this installation:

### Web Search Alternatives (No Brave API needed!)

| Provider | Status | How to Enable |

|----------|--------|---------------|

| **Perplexity Sonar** | NOT CONFIGURED | Set `OPENROUTER_API_KEY` or `PERPLEXITY_API_KEY` in config |

| **Firecrawl** | NOT CONFIGURED | Set `FIRECRAWL_API_KEY` - handles JS-heavy sites |

**Perplexity is potentially better than Brave** - returns AI-synthesized answers with citations.

```json5
// Add to ~/.clawdbot/clawdbot.json
{
  "tools": {
    "web": {
      "search": {
        "provider": "perplexity",
        "perplexity": {
          "apiKey": "sk-or-...",  // OpenRouter key
          "model": "perplexity/sonar-pro"
        }
      }
    }
  }
}
```

### Browser Automation Options

| Option | Current Status | Notes |

|--------|----------------|-------|

| Chrome extension relay | NOT USED | Control existing Chrome tabs without separate browser |

| Node browser proxy | NOT USED | Route browser commands to Windows host |

| Remote browser control | NOT USED | `clawdbot browser serve` on Windows |

### Other Unused Features

- **Lobster workflows** - Typed workflow runtime with approvals
- **ClawdHub skills** - `clawdhub` CLI not installed (hub is empty anyway)
- **Multi-profile browser** - Separate profiles for different use cases
- **Tool profiles** - `minimal`, `coding`, `messaging`, `full` presets

---

## Upstream Repository Status

### Current State

- **Local fork:** 4 commits, no git remote configured
- **Upstream:** `github.com/clawdbot/clawdbot` at v2026.1.24 (Jan 25, 2026)
- **Delta:** Unknown - need to add remote and compare

### Latest Release Highlights (v2026.1.24)

From the changelog:

- LINE channel plugin
- Edge TTS fallback (keyless!)
- Exec approvals via `/approve` in chat
- Telegram DM topics as separate sessions
- **Brave freshness filter** for time-scoped search results
- Control UI dashboard refresh

### How to Add Upstream Remote

```bash
cd /home/liam/clawdbot
git remote add upstream https://github.com/clawdbot/clawdbot.git
git fetch upstream
git log --oneline upstream/main -10  # See what's new
```

---

## ClawdHub Status

- **Website:** https://clawdhub.com
- **Skills available:** NONE ("No skills yet. Be the first.")
- **CLI installed:** NO (`clawdhub` command not found)

**Recommendation:** Install CLI but don't expect skills yet:

```bash
npm i -g clawdhub
```

---

## The "Frankenstein GIF" Paradox - Explained

**What Liam claimed:** "I couldn't search because BRAVE_API_KEY is missing and no browser available"

**What actually happened:**

1. Liam tried `web_fetch` on Tenor/GIPHY - got HTTP 200 but empty content (JS sites)
2. Liam did NOT try the Z.AI search skill (which has a bug anyway)
3. The "links" Liam provided were **URL templates from training knowledge**, not search results
4. Example: `https://giphy.com/search?q=frankenstein` is just a known URL pattern

**Root cause:** Multiple issues conflated:

- Z.AI search skill has wrong endpoint
- `web_fetch` can't extract from JS-heavy sites
- Browser automation not available
- Liam diagnosed "missing API key" when the real issue was a bug

---

## Root Cause Analysis

The system has a **data staleness problem**:

1. STATUS.md was written when capabilities were expected to work
2. Actual verification failed but STATUS.md wasn't updated
3. Liam reads STATUS.md and believes capabilities exist
4. When tools fail, Liam reports the wrong root cause (API keys) instead of the actual issue (wrong URL, missing software)

**The fix:** Automated health checks should update STATUS.md, not just report to Slack.

---

## Priority Action Items

### Critical (Do First)

1. Fix Z.AI search skill endpoint bug
2. Update STATUS.md with actual system state

### High Value (Quick Wins)

3. Configure Perplexity/OpenRouter for web search (no Brave API needed)
4. Enable Google Calendar API in Google Cloud Console

### Medium Priority

5. Add upstream git remote and evaluate updates
6. Install clawdhub CLI

### Optional

7. Install Go + blogwatcher if RSS monitoring is wanted
8. Explore Chrome extension relay for browser automation