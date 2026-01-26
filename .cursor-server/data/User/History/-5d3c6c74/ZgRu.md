# Evolution Queue

> Liam: Propose improvements here. Simon reviews in Cursor, Claude implements approved items.

## How to Submit

Add items under "## Pending" using this format:

```
### [YYYY-MM-DD-NNN] Short title
- **Proposed by:** Liam
- **Date:** YYYY-MM-DD
- **Category:** behavior | identity | rules | tools | memory | showcase-idea
- **Target file:** (which file would change, or "new skill")
- **Description:** What to change and why
- **Status:** pending
```

## Pending

### [2026-01-25-003] Instagram Intelligence Deployment
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New skill deployment
- **Description:** Built overnight build (Instagram Intelligence Suite) with scripts for API-based scraping, image download, AI analysis, insights generation, and reporting. Currently awaiting Simon's Instagram Basic Display API access token. Once deployed, will provide automated monitoring of @cerafica_design for new posts, sales announcements, and show dates.
- **Impact:** High - Proactive business intelligence for Simon's ceramics business
- **Solution:** Simon obtains API token → Install scripts to system PATH → Set up cron job → Create Slack alerting
- **Status:** pending (postponed by Simon)

### [2026-01-25-007] Low-Friction Capture Methods
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New capabilities
- **Description:** NeuroSecond requires <2 second capture. Voice capture (pending Whisper.cpp) is primary. Need additional methods: Slack quick-capture command (`/note <text>`), mobile-friendly web form, email-to-capture (clawdbot@puenteworks.com). Multiple capture methods ensure friction-free thought capture.
- **Impact:** High - Critical for NeuroSecond methodology
- **Solution:** Create Slack slash command, build simple web form, set up email parsing
- **Status:** pending

### [2026-01-25-010] Automated Summarization for NeuroSecond "Distill"
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New capability
- **Description:** NeuroSecond "Distill" stage needs: on-demand note summarization, automatic action item extraction, connection finding between notes, weekly review generation. Should leverage AI to surface insights and reduce cognitive load.
- **Impact:** Medium - Reduces manual review burden
- **Solution:** Build summarization pipeline, action item extraction, connection detection, weekly review generator
- **Status:** pending

### [2026-01-25-011] Notion Skill for PARA Database Integration
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New skill (notion)
- **Description:** Notion skill exists at ~/clawdbot/skills/notion/SKILL.md but not yet integrated. PARA system could benefit from Notion database integration for projects, areas, resources, archives. Would provide structured knowledge management.
- **Impact:** Low-Medium - Depends on Simon's Notion usage
- **Solution:** Integrate Notion skill, design PARA database schema, implement CRUD operations
- **Status**: pending

### [2026-01-25-012] Automated Testing for Overnight Builds
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** Overnight build process
- **Description:** Currently manual testing of overnight builds. Every overnight project should include test.sh script. Need automated testing before delivery to Simon, with test coverage reports. Ensures quality and reduces broken deliveries.
- **Impact:** Medium - Improves overnight build reliability
- **Solution:** Add test.sh to all templates, automated testing pipeline, coverage reports
- **Status:** pending

## Approved

### [2026-01-25-002] Whisper.cpp Installation for Voice Capture
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New skill installation
- **Description:** Voice Wake marked PENDING in STATUS.md. Low-friction voice capture is critical for NeuroSecond methodology - need <2 second capture speed for thoughts and ideas. Voice input is most natural way for neurodivergent users to capture information without breaking flow.
- **Impact:** High - Enables core NeuroSecond "Capture" stage
- **Solution:** Install Whisper.cpp locally, integrate with audio input capture, test transcription accuracy
- **Status:** approved (Simon) - Waiting for build tools installation

### [2026-01-25-004] GitHub PR/Issue Monitoring Integration
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New skill (github)
- **Description:** No automated monitoring of Simon's GitHub activity (Pastorsimon1798). Currently must manually check for new PRs/Issues. Would benefit from daily digest of activity and alerts on urgent items requiring review. GitHub skill exists at ~/clawdbot/skills/github/SKILL.md but not yet integrated into proactive workflow.
- **Impact:** Medium - Better support for Simon's coding work
- **Solution:** Set up monitoring of Pastorsimon1798, daily activity summaries, urgent alerts to Slack
- **Status:** approved (Simon) - Waiting for gh auth login

## Implemented

### [2026-01-25-001] Enable Memory Search for Semantic Recall
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Configured local Ollama embeddings using `nomic-embed-text` via OpenAI-compatible API. Updated `clawdbot.json` and `STATUS.md`.

### [2026-01-25-005] Enhanced Calendar with Preparation Reminders
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Updated `HEARTBEAT.md` with 24h alerts, 2h reminders, post-meeting summaries, and conflict detection.

### [2026-01-25-006] PARA Task Management Integration
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Created `para-tasks` skill with SQLite backend (`para.sqlite`) and Python-based CRUD scripts.

### [2026-01-25-008] Context Cue System for ADHD Support
- **Implemented:** 2026-01-25
- **Category:** behavior
- **Solution:** Created `liam-cue` command and updated `HEARTBEAT.md` to proactively surface context and next actions.

### [2026-01-25-009] Visual Timer Integration for Time Blindness
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Created `visual-timer` skill wrapping Clawdbot's cron system for Slack-based timers.

### [2026-01-25-013-015] System Health & Self-Diagnostics Suite
- **Implemented:** 2026-01-25
- **Category:** tools
- **Solution:** Enhanced `health-check.sh` with auto-fix flag, added daily `Liam-Self-Diagnostics` cron job.

## Rejected

(Declined with reason)
