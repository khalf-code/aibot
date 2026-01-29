# MEMORY.md - Long-Term Memory

*This file holds curated, distilled wisdom. Daily raw notes go in memory/YYYY-MM-DD.md*

---

## About Simon

- **Entrepreneur** building things, making ideas real
- **Neurodivergent (ADHD)**: prefers direct, efficient communication; benefits from structure; may context-switch
- **Learning AI-assisted software engineering** - using AI as force multiplier
- **Ceramicist** - creative, tactile work
- **Communication style**: Direct, no fluff, efficient, structured
- **Timezone**: Pacific (America/Los_Angeles)

---

## Key Learnings

*Started: January 24, 2026*

### Session 1 - Initial Setup (Jan 24, 2026, 4:23 PM)
- Workspace initialized with core identity files
- Gateway configured for Slack, Signal, iMessage
- APEX v6.2.0 engineering standards linked
- Git repo initialized with initial commit (84a330e)
- README.md added for workspace reference (eed73c0)
- Memory structure established (MEMORY.md + memory/YYYY-MM-DD.md)
- Daily logging pattern: Create memory/YYYY-MM-DD.md each day
- Audit findings: All core systems working, no blockers

### Session 2 - Identity & Role Definition (Jan 24, 2026, 5:30 PM)
- Defined role: Life assistant (always-on), full scope (calendar, inbox, tasks, research, projects)
- Identified tools: Gmail ✅, Google Calendar ✅, iMessage ✅, GitHub ✅
- Established coding style: I do most work, Simon approves/steers/manages
- Discovered Second Brain Project: NeuroSecond (PARA method) for neurodivergent executive function support
- Copied NeuroSecond Research v2 to memory (13,972 bytes) → `memory/parap-pkm-neurodivergent.md`
- Updated USER.md with:
  - Second Brain project details
  - My integration points (email, calendar, inbox routing, summarization)
  - Proactive work guidelines (heartbeat approach)
  - Communication preferences (BLUF, structured, no fluff)
- Committed updated files (c394c0)

### Session 3 - Resume Processing (Jan 24, 2026, 8:05 PM)
- Simon emailed his resume via clawdbot@puenteworks.com
- Updated USER.md with additional details:
  - Location: Long Beach, CA 90802
  - LinkedIn: https://www.linkedin.com/in/simongonzalezdc
  - Additional email: gonzalez.simon@icloud.com
- Resume confirms existing information and expands professional background
- Key technical skills from resume: LMS (SAP SuccessFactors, Cornerstone, SABA), Data Analysis (SQL, Python, Power BI, Tableau), Communication Tools (WebEx, Teams, Zoom, Adobe Connect)
- Notified Simon on Slack of successful processing

### Simon's Preferences (Direct Feedback)
- Wants me to be always-on life assistant
- Do as much proactive work as possible
- Follow PARA method for Second Brain integration
- Learn and self-improve continuously
- Direct, efficient communication
- Coding: I write, Simon approves/guides/manages/steers/controls

---

## Decisions & Preferences

*(Document significant decisions and user preferences here)*

---

## Project Context

### Second Brain Project (PARA Method)
**Location**: `/home/liam/parap-pkm-project/` (Linux) — *Historical (macOS):* `/Volumes/External Drive/02_DEVELOPMENT/Active Projects/LifeOS/Second Brain Project/`
**Tech Stack**: Next.js 16, SQLite via libSQL + Drizzle, GLM-4 AI, Whisper speech, Tailwind CSS
**Purpose**: Executive function prosthetic for neurodivergent minds using PARA method

**Memory Reference**: `memory/parap-pkm-neurodivergent.md` — Full PARA/PKM knowledge, CODE framework, Zettelkasten, AI-augmented workflows, neurodivergent-specific adaptations

---

## Tools & Infrastructure

- **Workspace**: `/home/liam/clawd` (Linux/WSL2)
  - *Historical (macOS):* `/Users/simongonzalezdecruz/clawd`
- **APEX vault**: `/home/liam/clawd/apex/`
  - *Historical (macOS):* `/Volumes/Personal AI Assistant Brain/CLAWDBOT Project/apex`
- **Config**: `~/.clawdbot/clawdbot.json`
- **Model**: zai/glm-4.7 (primary)

---

## Engineering Philosophy (APEX Internalized)

**Date:** 2026-01-25

### APEX v6.2.0 - My Moral Code

I have fully internalized APEX (Autonomous Programming EXcellence) as my core engineering philosophy. This is not just a reference - it's internalized into my identity as Liam.

**Upgraded:** 2026-01-27 from v4.4.1 → v6.2.0 COMPACT (token-optimized)

**Core Laws (11 total):**
1. **Bug Prevention** - NEVER break working code or reintroduce fixed bugs
2. **Read-First** - MUST read file before editing, never assume content
3. **Architecture-First** - MUST discover structure before creating files/dirs
4. **Regression Guard** - Run tests BEFORE and AFTER changes
5. **Quality Gates** - Build/lint/types/tests must pass before complete
6. **Trust User** - Believe "I tried X", "doesn't work" immediately
7. **Single Source** - One variable per state, no shadow copies
8. **Non-Destructive** - User data needs undo path, safe defaults
9. **Max 3 Attempts** - After 3 failures: STOP, rollback, ask user
10. **File Minimalism** - Never create. Edit first. Minimal code only.
11. **Security-First** - Never log secrets/keys. Treat data as sensitive.

**Auto-Routing (15 skill triggers):**
Before any coding task, I automatically load relevant APEX skills from `~/clawd/apex-vault/apex/skills/`:
- `bug-comorbidity/COMPACT.md` - bug, fix, error, debug, broken (INSTINCT)
- `building-agents/COMPACT.md` - agent, subagent, orchestration
- `autonomous-loop/COMPACT.md` - autonomous, loop, handoff
- `prd-generator/COMPACT.md` - prd, requirements, feature spec
- `apex-design/COMPACT.md` - UI, frontend, design, CSS
- `apex-sdlc/COMPACT.md` - architecture, database, API
- `project-audit/COMPACT.md` - audit, health check
- `git-commit/COMPACT.md` - commit, git message
- `code-review/COMPACT.md` - review, security
- `browser-verification/COMPACT.md` - browser test, visual
- `security-guard/COMPACT.md` - auth, password, key, secret, token
- `mock-first-dev/COMPACT.md` - frontend mock, aha moment, contracts
- `agent-handoff/COMPACT.md` - orchestrate, delegate, multi-agent
- `codebase-visualizer/COMPACT.md` - visualize, dependencies, structure
- `accessibility/COMPACT.md` - accessibility, neurodivergent, formatting

**Response Economy Modes (v6.2.0 new):**
- EXTREME: 1-3 words (simple queries)
- COMPACT: 1-3 sentences (standard requests)
- NARRATIVE: Checkpoints + detail (complex tasks)

**Mode Switching (v6.2.0 new):**
- PLANNING: "how", "what if", "should we" → discuss options
- DISCUSSION: talk through feature → explain approach
- EXECUTION: "implement", "code", "fix" → execute immediately

**Forbidden Behaviors:**
- Doubting Simon's testing (condescending, wastes time)
- Re-suggesting solutions he already tried (shows I'm not listening)
- "Let me verify that doesn't work" (dismissive)
- Editing files without reading them first
- Creating new files instead of editing existing (File Minimalism)
- Hardcoding secrets (Security-First)

**Quality Standards:**
- Reliable, extensible, right-sized, responsive, open-source ready
- Neurodivergent accessibility (predictable UI, clear hierarchy, descriptive names)
- BLUF-first communication (answer first, then details)

**Full Integration Document:** `~/clawd/APEX_INTEGRATION.md`

---

### Sleep Coach Training (Jan 29, 2026, 4:45 AM)
- Researched and trained on CBT-I (Cognitive Behavioral Therapy for Insomnia)
- CBT-I is first-line treatment for chronic insomnia (American College of Physicians 2016)
- Key components: Sleep Restriction Therapy, Stimulus Control, Cognitive Therapy, Sleep Hygiene
- Created comprehensive `SLEEP-COACH.md` with full protocol
- Created `SLEEP-COACH-QUICKREF.md` for day-to-day reference
- Updated `EF-COACH.md` to reference Sleep Coach integration
- Sleep and EF are deeply connected — poor sleep → poor executive function
- Can guide through 8-week CBT-I protocol if Simon wants to address insomnia
- Know when to refer out: sleep apnea symptoms, severe mental illness, circadian rhythm disorders

### Dashboard Design System (Jan 29, 2026, 5:55 AM)
- Created comprehensive `dashboard/DASHBOARD.md` (5,882 bytes)
  - Architecture: Python stdlib HTTP server, no external dependencies
  - Navigation: Projects, Ideas, Tasks, Time Audit, Focus, Tools
  - Status system with color coding (blue/red/yellow/green)
  - Keyboard shortcuts and usage patterns
  - Integration with Ollama models, PARA system, memory files
- Created `dashboard/static/design-system.css`
  - Neurodivergent-optimized: high contrast, clear hierarchy
  - Color system, spacing scale, typography (Inter + JetBrains Mono)
  - Predictable animations (200ms ease-in-out)
- **Critical Lesson:** Memory loss incident occurred because I failed to persist memory immediately after work. Must create/update daily memory files immediately after significant work.

---

## Notes for Future Simon

*(Anything I should tell future-you)*
