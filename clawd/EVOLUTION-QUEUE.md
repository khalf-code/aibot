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

### [2026-01-25-019] Digital Download Business Research & Strategy
- **Proposed by:** Simon (via Slack)
- **Date:** 2026-01-25
- **Category:** showcase-idea
- **Target file:** ~/clawd/plans/digital-download-business-iteration2.md (reference)
- **Description:** Simon requested research and brainstorming of digital download business ideas as a second source of income. Conducted 2 iterations of research following APEX v4.4.1 standards. Delivered comprehensive analysis with 7+ business ideas, competitor research, pricing strategies, go-to-market plans, and validation experiments. Top 3 recommendations: (1) LMS Analytics Templates Vault ($800K-1.2M/mo potential, 9-week timeline, leverages Simon's LMS experience), (2) AI-Powered Data Analysis Accelerator ($1.5M-3M/mo, 9-week timeline, fits Simon's core skills), (3) Ceramics Business Intelligence Dashboard ($300K-600K/mo, 10-week timeline, sustainable niche with Instagram integration). Research includes competitor analysis, pricing benchmarks, technical feasibility, and validation experiments for each concept.
- **Impact:** High - Provides actionable path to secondary income, leverages Simon's domain expertise (LMS, data analytics, ceramics)
- **Solution:** Full research documented in iteration files; requires Simon's decision on which concept(s) to pursue; implementation can proceed once concept selected
- **Status:** pending - research complete, awaiting Simon's decision

### [2026-01-25-017] Clawdbot-Native Calendar with Google Sync
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New skill (calendar)
- **Description:** Build a native calendar solution for Clawdbot, inspired by nettu-scheduler's architecture but optimized for Simon's workflow. **CORE REQUIREMENT: Two-way sync with Google Calendar (clawdbot@puenteworks.com)**. Will support: accounts, users, calendars, events (single + recurring), reminders, Slack integration, PARA project linking, and Google Calendar bidirectional sync. Tech stack: TypeScript, Hono.js, SQLite with Drizzle ORM, googleapis library. Features: CRUD API, recurrence rules, metadata queries, reminder system via cron, Slack commands (/cal add, /cal list, /cal upcoming, /cal sync), natural language parsing, Google Calendar import/export/sync.
- **Impact:** High - Unblocks calendar alerts and meeting prep, replaces broken Google Calendar API access, enables tighter integration with PARA and Slack, provides reliable two-way sync
- **Solution:** 5-phase implementation: (1) Foundation - DB + core CRUD (3-5 days), (2) Recurrence & querying (2-3 days), (3) Reminders with Slack delivery (2-3 days), (4) Google Calendar two-way sync (5-7 days) - CORE REQUIREMENT, (5) Clawdbot integration - Slack commands, heartbeat, PARA (2-3 days). Full plan at /home/liam/clawd/plans/calendar-solution-plan.md. Phase 4 includes: Google Calendar API client, schema mapping, import/export, bidirectional sync, conflict resolution, auto-sync cron job.
- **Status:** pending - waiting for approval; requires Google Calendar API to be enabled first

### [2026-01-25-015] Data Analytics Capabilities Enhancement
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New skill(s) or capabilities
- **Description:** Simon is a professional data analyst and wants Liam to assist with data analytics work. Need to research and implement capabilities that support Simon's data analytics workflows: data import/export, analysis, visualization, reporting. Simon's expertise includes Excel (Pivot Tables, VLOOKUP, XLOOKUP, Power Query), SQL, Python, Power BI, Tableau, and data from Workday, SAP SuccessFactors, Salesforce CRM, etc.
- **Impact:** High - Leverages Simon's professional skills, enables AI-assisted analytics
- **Solution:** Research and build data analytics skills: SQL querying, data processing (Python/pandas), visualization generation, automated reporting, Excel file processing
- **Status:** pending - needs research and planning

### [2026-01-25-018] Edison Learning Operations Job Opportunity Tracking
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** memory
- **Target file:** MEMORY.md
- **Description:** Simon interviewed for "EDISON Learning Operations Senior Specialist" position on Friday, Jan 23, 2026. He forwarded the job posting PDF via email to me. Given his background in Learning Management Systems (Capital Group: Talent Development Associate, 8,000+ associates trained; Southern California Edison: LMS admin, SAP SuccessFactors; PIMCO: LMS coordinator, Cornerstone CSOD), this role aligns with his expertise. Need to track this opportunity, research EDISON company, prepare for follow-up, and document interview learnings.
- **Impact:** Medium - Career advancement opportunity aligned with Simon's LMS expertise
- **Solution:** Track application status, research EDISON company details (size, products, clients, tech stack), prepare potential interview questions, monitor email for follow-up, document interview outcomes and learnings
- **Status:** pending - active job opportunity, awaiting follow-up

### [2026-01-25-016] PuenteWorks Documentation Import
- **Proposed by:** Simon (via email)
- **Date:** 2026-01-25
- **Category:** memory
- **Target file:** MEMORY.md and memory/*.md
- **Description:** Simon has PuenteWorks documentation on his original Mac that he wants to import into my memory. The documentation is in his old Claude account. Need to download and ingest this information to understand PuenteWorks better - its products, services, history, clients, processes, and vision.
- **Impact:** High - Critical context for supporting Simon's business
- **Solution:** Simon retrieves documentation from Mac/Claude account → Liam ingests and processes → Updates MEMORY.md with PuenteWorks knowledge → Enables better business support
- **Status:** pending - waiting for Simon to provide files

### [2026-01-25-020] Web Search API & Browser Automation Configuration [CRITICAL]
- **Proposed by:** Liam (Urgent request from Simon)
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** ~/.clawdbot/clawdbot.json (configuration)
- **Priority:** CRITICAL - "This supposed block for tool use is not acceptable" (Simon)
- **Description:** Web search and browser automation are BLOCKED. APEX Mission (Frankenstein scene search) failed due to missing fundamental web capabilities. This is UNACCEPTABLE for a fully functional AI assistant. Web search tool returns "missing_brave_api_key" error - `clawdbot configure --section web` or set BRAVE_API_KEY needed. Browser automation returns 500 error "No supported browser found" - requires Chrome/Brave/Edge/Chromium on macOS/Linux/Windows. This BLOCKS all web research, image searches, content discovery, and browser automation tasks.
- **Impact:** CRITICAL - Cannot perform web research, find information, search images/media, browse websites, or complete APEX missions requiring web access. This is a core capability gap.
- **Solution:** URGENT - Execute ONE of these immediately: (1) Configure BRAVE_API_KEY in Gateway config for web_search tool (Get key: https://brave.com/search/api/), OR (2) Install Chrome/Chromium on NucBoxEVO-X2 (Windows host) for browser automation, OR (3) Enable browser proxy service for WSL2 environment. Recommended: Option 1 (configure API key) - fastest resolution.
- **Status:** CRITICAL PENDING - Requires immediate action by Simon in Cursor session to unblock core web capabilities

### [2026-01-25-014] Blogwatcher Installation and Setup
- **Proposed by:** Liam
- **Date:** 2026-01-25
- **Category:** tools
- **Target file:** New tool installation
- **Description:** Cron job "Blogwatcher-Check" (ID: 5b0b7dd4-8ba6-4d9f-98c9-f1ad50aaf188) is blocked because blogwatcher CLI is not installed. Go (required to install) is also not on the system. Verified at 22:00 PST when cron job ran. Need to install Go and blogwatcher CLI, then configure it for RSS/Atom feed monitoring. Currently alerts Simon of interesting content from monitored blogs.
- **Impact:** Low-Medium - Proactive content monitoring, but not critical
- **Solution:** Install Go, install blogwatcher (`go install github.com/Hyaxia/blogwatcher/cmd/blogwatcher@latest`), configure feeds for Simon's interests
- **Status:** pending

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
