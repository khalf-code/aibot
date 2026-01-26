---
name: APEX Audit Remediation
overview: "Fix 30 remaining issues from APEX audit: gateway token exposure (2), invalid model references (18), stale macOS paths (7), and wrong email references (3)."
todos:
  - id: fix-gateway-token
    content: "CRITICAL: Move gateway token to liam.env and remove hardcoded values"
    status: pending
  - id: fix-model-refs-config
    content: Fix invalid zai model references in clawdbot.json and cron/jobs.json
    status: pending
  - id: fix-model-refs-docs
    content: Fix invalid model references in SOUL.md, JOB.md, MEMORY.md, STATUS.md
    status: pending
  - id: fix-stale-paths
    content: Mark or update stale macOS paths in docs and scripts
    status: pending
  - id: fix-email-refs
    content: Fix wrong email in Instagram Intelligence files
    status: pending
isProject: false
---

# APEX Audit Remediation Plan

## Phase 1: Gateway Token Security (CRITICAL)

### 1.1 Move token to liam.env
Add `CLAWDBOT_GATEWAY_TOKEN` to `~/.clawdbot/credentials/liam.env`

### 1.2 Update clawdbot.json
Replace hardcoded token at line 228 with environment variable reference or placeholder

### 1.3 Update systemd service
Remove hardcoded `Environment=CLAWDBOT_GATEWAY_TOKEN=...` from `clawdbot-gateway.service` (already uses EnvironmentFile)

---

## Phase 2: Invalid Model References (18 fixes)

Replace all `zai/glm-4.7` and `zai/glm-4.7-flashx` with valid model `ollama/gemma3:4b` (local) or keep as documentation:

### Config files (must fix - affects runtime):
- `~/.clawdbot/clawdbot.json`: Remove zai provider, fix primary model, allowedModels
- `~/.clawdbot/cron/jobs.json`: Fix 3 job model references

### Documentation files (update for accuracy):
- `~/clawd/SOUL.md` line 125
- `~/clawd/JOB.md` lines 91-93
- `~/clawd/MEMORY.md` line 89
- `~/clawd/STATUS.md` lines 116, 130-134

---

## Phase 3: Stale macOS Paths (7 fixes)

Mark as historical or update:
- `~/clawd/MEMORY.md` line 74
- `~/gog-reference.md` lines 8, 17
- `~/clawdbot/skills/social-media/social.sh` line 7
- `~/clawdbot/skills/inventory/inventory.sh` lines 7-8
- Backup copies in `clawdbot_skills_backup/`

---

## Phase 4: Wrong Email References (2 fixes)

Change `simon@puenteworks.com` to `clawdbot@puenteworks.com`:
- `~/clawd/overnight-builds/instagram-intelligence/README.md` line 36
- `~/clawd/overnight-builds/instagram-intelligence/setup.sh` line 31