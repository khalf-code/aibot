# Opportunity Lifecycle Skill

> **Purpose:** Manage opportunities through discovery, research, preparation, monitoring, and documentation.

## Overview

This skill implements the Opportunity Lifecycle Framework (see `/home/liam/clawd/OPPORTUNITY-LIFECYCLE.md`). It provides tools and workflows for tracking opportunities across their entire lifecycle.

## Installation

```bash
# Create database schema
cd ~/clawdbot/skills/opportunity-lifecycle
./init-db.sh
```

## Database Schema (SQLite)

Location: `~/clawdbot/skills/opportunity-lifecycle/opportunities.sqlite`

### Table: opportunities

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| title | TEXT | Opportunity name/description |
| type | TEXT | career/business/project/creative |
| stage | TEXT | identify/research/prepare/monitor/document/complete/declined |
| status | TEXT | active/paused/closed |
| created_at | TEXT | ISO timestamp when created |
| updated_at | TEXT | ISO timestamp when last updated |
| notes | TEXT | General notes and context |

### Table: research_notes

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| opportunity_id | INTEGER | FK to opportunities.id |
| category | TEXT | who/what/required/context/fit |
| content | TEXT | Research findings |
| source | TEXT | URL or source reference |
| created_at | TEXT | ISO timestamp |

### Table: preparations

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| opportunity_id | INTEGER | FK to opportunities.id |
| prep_type | TEXT | interview/proposal/project/meeting/other |
| content | TEXT | Preparation notes, questions, materials |
| status | TEXT | pending/done |
| created_at | TEXT | ISO timestamp |

### Table: actions

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| opportunity_id | INTEGER | FK to opportunities.id |
| action | TEXT | Action item description |
| due_date | TEXT | ISO date or NULL |
| status | TEXT | pending/in_progress/completed |
| created_at | TEXT | ISO timestamp |

### Table: learnings

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| opportunity_id | INTEGER | FK to opportunities.id |
| learning_type | TEXT | what_worked/what_didnt/insights/patterns |
| content | TEXT | Learning details |
| created_at | TEXT | ISO timestamp |

## Scripts

### list.sh - List opportunities

```bash
./list.sh [all|active|stage:<stage_name>]
```

Examples:
- `./list.sh` - List all active opportunities
- `./list.sh all` - List all opportunities including closed
- `./list.sh stage:research` - List opportunities in research stage

### create.sh - Create new opportunity

```bash
./create.sh <title> <type>
```

Types: career, business, project, creative

### update-stage.sh - Update opportunity stage

```bash
./update-stage.sh <opportunity_id> <new_stage>
```

Stages: identify, research, prepare, monitor, document, complete, declined

### add-research.sh - Add research notes

```bash
./add-research.sh <opportunity_id> <category> <content> [source]
```

Categories: who, what, required, context, fit

### add-prep.sh - Add preparation

```bash
./add-prep.sh <opportunity_id> <prep_type> <content>
```

Prep types: interview, proposal, project, meeting, other

### add-action.sh - Add action item

```bash
./add-action.sh <opportunity_id> <action> [due_date]
```

Due date format: YYYY-MM-DD or leave empty for no deadline

### add-learning.sh - Add learning

```bash
./add-learning.sh <opportunity_id> <learning_type> <content>
```

Learning types: what_worked, what_didnt, insights, patterns

### show.sh - Show opportunity details

```bash
./show.sh <opportunity_id>
```

Displays full opportunity with all research, prep, actions, and learnings.

### update-status.sh - Update opportunity status

```bash
./update-status.sh <opportunity_id> <new_status>
```

Statuses: active, paused, closed

## Usage Examples

### Example 1: Track a Job Application

```bash
# Create opportunity
./create.sh "EDISON Learning Operations Specialist" career

# Add research
./add-research.sh 1 who "EDISON International, energy utility company, 13,000+ employees" "https://www.edison.com"
./add-research.sh 1 what "Senior Specialist role in Learning Operations" "job posting"
./add-research.sh 1 fit "Aligns with Simon's LMS expertise at Capital Group and SCE" "resume"

# Add preparation
./add-prep.sh 1 interview "Questions: What LMS do you use? Team size? Career growth paths?"

# Add action
./add-action.sh 1 "Email follow-up to recruiter" "2026-01-28"
```

### Example 2: Track Business Opportunity

```bash
# Create opportunity
./create.sh "PuenteWorks AI consulting partnership" business

# Add research
./add-research.sh 1 who "Small business AI solutions company, founder reached out"
./add-research.sh 1 what "Partnership for AI implementation services"
./add-research.sh 1 required "Service agreement, scope of work, pricing model"

# Move to prepare stage
./update-stage.sh 1 prepare
```

### Example 3: Document Learnings After Opportunity Closes

```bash
# Move to document stage
./update-stage.sh 1 document

# Add learnings
./add-learning.sh 1 what_worked "Direct email follow-up got response within 24h"
./add-learning.sh 1 what_didnt "Initial pitch too generic, needed specific use cases"
./add-learning.sh 1 insights "Small businesses respond faster than enterprises"
./add-learning.sh 1 patterns "Personal connection > generic outreach"

# Mark complete
./update-stage.sh 1 complete
./update-status.sh 1 closed
```

## Integration with Heartbeat

Add to `HEARTBEAT.md`:

```markdown
## Opportunity Monitoring

Check active opportunities:
1. List active opportunities: `~/clawdbot/skills/opportunity-lifecycle/list.sh`
2. Check for actions due today or overdue
3. Alert Simon to urgent opportunities (deadline < 24h or stage changed recently)
4. For opportunities in "research" stage: surface any new findings
5. For opportunities in "monitor" stage: check for status updates
```

## Integration with PARA Tasks

When opportunity actions are created, optionally link them to PARA tasks:

```bash
# When creating action item, offer to create PARA task
# Example: "Action: Email recruiter → Create PARA task 'Email EDISON recruiter follow-up'?"
```

## Best Practices

1. **Always ask first:** "Want me to track this opportunity using the lifecycle framework?"
2. **Start with research:** Immediately begin researching after creation
3. **Proactive monitoring:** Don't wait to be asked—check status daily
4. **Document learnings:** Extract 3-5 key learnings when opportunity closes
5. **Clean up regularly:** Archive completed/declined opportunities to keep database clean

## Troubleshooting

### Database locked error
- Only one process can write to SQLite at a time
- Wait a few seconds and retry

### Scripts not executable
- Run: `chmod +x *.sh` in the skill directory

### Opportunity not found
- List all opportunities first: `./list.sh all`
- Check the ID

## Related Files

- Framework documentation: `/home/liam/clawd/OPPORTUNITY-LIFECYCLE.md`
- Evolution Queue: `/home/liam/clawd/EVOLUTION-QUEUE.md`
- PARA tasks: `~/clawdbot/skills/para-tasks/`

---

**Created:** 2026-01-25
**Maintained by:** Liam
