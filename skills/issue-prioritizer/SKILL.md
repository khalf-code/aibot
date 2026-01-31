---
name: issue-prioritizer
description: Prioritize/triage GitHub issues and generate a ranked report (quick wins, critical bugs, recommendations) using the Glucksberg/issue-prioritizer CLI + GitHub CLI (gh). Use when asked to prioritize issues, triage a backlog, find quick wins, or decide what to work on next for an owner/repo.
---

# Issue Prioritizer (clawdbot skill)

Use the local **Glucksberg/issue-prioritizer** CLI to score and rank GitHub issues.

## Requirements

- `gh` installed and authenticated (`gh auth status`)
- `bun` installed
- Local checkout of the tool repo (default): `/home/dev/agents/issue-prioritizer`

## Quick start

Run via the bundled wrapper script (recommended):

```bash
/home/dev/clawdbot/skills/issue-prioritizer/scripts/run.sh analyze owner/repo
```

Common variants:

```bash
# Markdown report
/home/dev/clawdbot/skills/issue-prioritizer/scripts/run.sh analyze owner/repo --output markdown

# Only quick wins
/home/dev/clawdbot/skills/issue-prioritizer/scripts/run.sh quick-wins owner/repo

# Best next issue for a beginner
/home/dev/clawdbot/skills/issue-prioritizer/scripts/run.sh next owner/repo --level beginner
```

## Commands

The wrapper forwards arguments to `issue-prioritizer`:

- `analyze <owner/repo>`: full report
- `quick-wins <owner/repo>`: high ROI, low effort
- `next <owner/repo>`: single best next issue
- `for-me <owner/repo> --level beginner|intermediate|advanced`: recommendations

Useful flags:

- `--limit N` (default 30)
- `--focus bugs|features|docs|all`
- `--level beginner|intermediate|advanced|any`
- `--output table|markdown|json`
- `--labels a,b,c` / `--exclude-labels a,b,c`

## Notes / Safety

- This is **read-only** prioritization: fetches issues via `gh issue list` and prints a ranking.
- Do **not** create PRs or modify repos unless the user explicitly asks.
