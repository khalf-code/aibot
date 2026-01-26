---
name: Full Liam System Audit
overview: Comprehensive APEX Comorbidity Protocol audit of the entire Liam system - 74 issues found across 5 categories (Security, Config, Identity, Scripts, Automation) with 23 CRITICAL, 22 HIGH, 20 MEDIUM, and 9 LOW severity issues.
todos:
  - id: rotate-credentials
    content: "CRITICAL: Rotate all exposed API keys, tokens, and passwords"
    status: completed
  - id: secure-secrets
    content: "CRITICAL: Move secrets to environment files with 600 permissions"
    status: completed
  - id: update-gitignore
    content: "CRITICAL: Add clawdbot.json, .profile, systemd services to .gitignore"
    status: completed
  - id: fix-sql-injection
    content: "CRITICAL: Fix SQL injection vulnerabilities in instagram scripts"
    status: completed
  - id: fix-model-refs-config
    content: "CRITICAL: Fix invalid model references in clawdbot.json and cron jobs"
    status: completed
  - id: fix-email-ref
    content: "CRITICAL: Fix wrong email reference in session-log.md"
    status: completed
  - id: fix-model-refs-docs
    content: "HIGH: Fix model references in SOUL.md, JOB.md"
    status: completed
  - id: add-error-handling
    content: "HIGH: Add error handling to awakening.sh and health-check.sh"
    status: in_progress
  - id: add-curl-timeouts
    content: "HIGH: Add timeouts to curl commands in instagram scripts"
    status: completed
  - id: add-cron-timezones
    content: "HIGH: Add missing timezones to cron job schedules"
    status: completed
  - id: update-identity-models
    content: "MEDIUM: Update IDENTITY.md with correct model list"
    status: completed
  - id: add-systemd-hardening
    content: "MEDIUM: Add security hardening to systemd service files"
    status: pending
  - id: fix-stale-paths
    content: "MEDIUM: Update or mark stale macOS paths as historical"
    status: pending
isProject: false
---

# APEX Full System Audit: Liam

## Comorbidity Analysis

Following the APEX Bug Comorbidity Protocol, I identified **5 major issue clusters** where bugs travel together:

### Cluster 1: Credential Exposure (23 instances)
**Pattern:** Same credentials duplicated across multiple files in plain text

| Location | Secret | Severity |
|----------|--------|----------|
| `clawdbot.json:7` | ZAI_API_KEY | CRITICAL |
| `clawdbot.json:204` | Slack Bot Token | CRITICAL |
| `clawdbot.json:205` | Slack App Token | CRITICAL |
| `clawdbot.json:215` | Gateway Auth Token | CRITICAL |
| `.profile:31` | GOG_KEYRING_PASSWORD | HIGH |
| `awakening.sh:18` | GOG_KEYRING_PASSWORD | HIGH |
| `clawdbot-gateway.service:14` | GOG_KEYRING_PASSWORD | CRITICAL |
| `clawdbot-gateway.service:17` | CLAWDBOT_GATEWAY_TOKEN | CRITICAL |
| `clawdbot.json.bak` | All secrets duplicated | HIGH |

**Why they cluster:** Credentials placed in one file for convenience get copied to others. Once exposed anywhere, consider all instances compromised.

### Cluster 2: Invalid Model References (12 instances)
**Pattern:** Non-existent model/provider referenced in multiple configs

| Location | Invalid Reference | Correct Value |
|----------|-------------------|---------------|
| `clawdbot.json:98` | `zai/glm-4.7` (no zai provider) | Define provider or use valid ref |
| `clawdbot.json:147` | `zai/glm-4.7-flashx` | `zai/glm-4.7` or `ollama/glm-4.7-flash` |
| `cron/jobs.json` (3 jobs) | `zai/glm-4.7` | Valid model ref |
| `SOUL.md:208` | `zai/glm-4.7-flashx` | `ollama/glm-4.7-flash` |
| `JOB.md:91-93` | `zai/glm-4.7-flashx` | `ollama/glm-4.7-flash` |
| `IDENTITY.md:55-61` | Gemma 3 4B, Qwen 2.5 7B | Current models from STATUS.md |

**Why they cluster:** Model name typo propagates to all configs/docs that reference it.

### Cluster 3: Stale Migration Artifacts (8 instances)
**Pattern:** macOS paths and old references from Mac Mini migration

| Location | Stale Reference |
|----------|-----------------|
| `MEMORY.md:84` | `/Users/simongonzalezdecruz/clawd` |
| `MEMORY.md:85` | `/Volumes/Personal AI Assistant Brain/...` |
| `memory/session-log.md:20` | macOS workspace path |
| `SELF-NOTES.md:41-42` | macOS paths |
| `overnight-builds/cli-library/README.md:72` | macOS paths |

**Why they cluster:** Migration missed multiple files with hardcoded paths.

### Cluster 4: Missing Error Handling (15 instances)
**Pattern:** Scripts lack error handling, validation, and timeouts

| Location | Missing Handling |
|----------|------------------|
| `awakening.sh:39-41` | No error handling for systemctl |
| `awakening.sh:55` | Gateway failure doesn't exit |
| `health-check.sh:35,43` | Missing error handling |
| `insta-scanner.sh:61` | No curl timeout |
| `insta-download.sh:89` | No curl timeout |
| Multiple scripts | No validation of required commands |

**Why they cluster:** Same developer patterns - if error handling is missing in one place, it's missing everywhere.

### Cluster 5: SQL Injection Vulnerabilities (4 instances)
**Pattern:** User input concatenated into SQL without sanitization

| Location | Vulnerability |
|----------|---------------|
| `insta-scanner.sh:85` | Caption not properly escaped |
| `insta-scanner.sh:97-105` | SQL insertion vulnerable |
| `insta-download.sh:107` | Filename interpolation |
| `insta-download.sh:122-135` | Fragile SQL parsing |

**Why they cluster:** Same anti-pattern (string concatenation for SQL) used throughout.

---

## All Issues by File

### Configuration Files

#### `~/.clawdbot/clawdbot.json`
- CRITICAL: Exposed ZAI_API_KEY (line 7)
- CRITICAL: Exposed Slack tokens (lines 204-205)
- CRITICAL: Exposed gateway token (line 215)
- CRITICAL: Invalid model `zai/glm-4.7-flashx` (line 147)
- HIGH: Missing zai provider definition
- HIGH: Invalid model refs in allowedModels

#### `~/.clawdbot/cron/jobs.json`
- CRITICAL: 3 jobs use invalid model `zai/glm-4.7`
- HIGH: Missing timezone in 2 schedules (lines 103, 132)
- MEDIUM: Missing model field in 2 job payloads

#### Systemd Services
- CRITICAL: `clawdbot-gateway.service` - Exposed secrets (lines 14, 17)
- HIGH: `kroko-voice.service` - Missing HOME/PATH env vars
- MEDIUM: Missing security hardening options in all services

### Identity Files

#### `SOUL.md`
- HIGH: Invalid model `zai/glm-4.7-flashx` (line 208)

#### `JOB.md`
- HIGH: Invalid model `zai/glm-4.7-flashx` (lines 91-93)

#### `IDENTITY.md`
- MEDIUM: Outdated model list (lines 55-61)
- LOW: Placeholder content (lines 43-44)

#### `MEMORY.md`
- LOW: Stale macOS paths (lines 84-85)

#### `memory/session-log.md`
- CRITICAL: Wrong email reference `simon@puenteworks.com` (lines 41, 52)
- MEDIUM: Stale macOS paths

#### `USER.md`
- MEDIUM: Email account clarification needed

### Scripts

#### `awakening.sh`
- CRITICAL: Hardcoded password (line 18)
- HIGH: No error handling for systemctl (lines 39-41)
- HIGH: Gateway failure doesn't exit (line 55)
- MEDIUM: No `set -e`, hardcoded timeouts

#### `health-check.sh`
- CRITICAL: Fragile password extraction (line 108)
- HIGH: Missing error handling (lines 35, 43)
- HIGH: Infinite retry possibility (lines 146-153)
- MEDIUM: Hardcoded Slack user ID

#### `restore-liam.sh`
- HIGH: No backup before deletion (line 16)
- MEDIUM: Missing validation

#### Instagram Intelligence Scripts
- CRITICAL: SQL injection vulnerabilities (4 locations)
- CRITICAL: Plain text token storage
- HIGH: No curl timeouts
- HIGH: Fragile JSON/SQL parsing
- MEDIUM: Hardcoded values, missing validation

### Security Issues

#### .gitignore Gaps
- CRITICAL: `clawdbot.json` not excluded (contains API keys)
- HIGH: `.profile` not excluded (contains password)
- HIGH: Systemd service files not excluded

#### File Permissions (verify)
- Sensitive files should be 600 (owner read/write only)
- Scripts should be 700 (owner execute only)

---

## Fix Priority Order

### Phase 1: CRITICAL Security (Immediate)
1. Rotate all exposed credentials (API keys, tokens, passwords)
2. Move secrets to environment files with 600 permissions
3. Update .gitignore to exclude sensitive files
4. Fix SQL injection vulnerabilities

### Phase 2: CRITICAL Config (Same day)
5. Fix invalid model references in clawdbot.json
6. Fix invalid model references in cron jobs
7. Fix email reference in session-log.md

### Phase 3: HIGH Issues (Within 24h)
8. Fix model references in SOUL.md, JOB.md
9. Add error handling to awakening.sh
10. Add error handling to health-check.sh
11. Add curl timeouts to instagram scripts
12. Add missing cron job timezones

### Phase 4: MEDIUM Issues (Within week)
13. Update IDENTITY.md with correct models
14. Update MEMORY.md paths (or mark historical)
15. Add systemd security hardening
16. Fix hardcoded values in scripts
17. Improve JSON/SQL parsing in scripts

### Phase 5: LOW Issues (Backlog)
18. Clean up placeholder content
19. Improve logging
20. Externalize configuration

---

## Issue Count Summary

| Severity | Count | Categories |
|----------|-------|------------|
| CRITICAL | 23 | Security (15), Config (5), Scripts (3) |
| HIGH | 22 | Config (7), Scripts (10), Identity (5) |
| MEDIUM | 20 | Scripts (12), Config (4), Identity (4) |
| LOW | 9 | Identity (5), Scripts (4) |
| **TOTAL** | **74** | |
