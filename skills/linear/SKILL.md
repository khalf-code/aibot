---
name: linear
description: Query and manage Linear issues, projects, and team workflows.
homepage: https://linear.app
metadata: {"clawdis":{"emoji":"📊","requires":{"env":["LINEAR_API_KEY"]}}}
---

# Linear

Manage issues, check project status, and stay on top of your team's work.

## Quick Commands

```bash
# My stuff
{baseDir}/scripts/linear.sh my-issues          # Your assigned issues
{baseDir}/scripts/linear.sh my-todos           # Just your Todo items
{baseDir}/scripts/linear.sh urgent             # Urgent/High priority across team

# Browse
{baseDir}/scripts/linear.sh team <MED|ONC>     # All issues for a team
{baseDir}/scripts/linear.sh project <name>     # Issues in a project
{baseDir}/scripts/linear.sh issue <MED-123>    # Get issue details
{baseDir}/scripts/linear.sh branch <MED-123>   # Get branch name for GitHub

# Actions
{baseDir}/scripts/linear.sh create <teamKey> "Title" ["Description"]
{baseDir}/scripts/linear.sh comment <MED-123> "Comment text"
{baseDir}/scripts/linear.sh status <MED-123> <todo|progress|review|done|blocked>
{baseDir}/scripts/linear.sh assign <MED-123> <userName>
{baseDir}/scripts/linear.sh priority <MED-123> <urgent|high|medium|low|none>

# Overview
{baseDir}/scripts/linear.sh standup            # Daily standup summary
{baseDir}/scripts/linear.sh projects           # All projects with progress
```

## CTO Workflows

### Morning Standup
```bash
{baseDir}/scripts/linear.sh standup
```
Shows: your todos, blocked items across team, recently completed, what's in review.

### Quick Issue Creation (from chat)
```bash
{baseDir}/scripts/linear.sh create MED "Fix auth timeout bug" "Users getting logged out after 5 min"
```

### Triage Mode
```bash
{baseDir}/scripts/linear.sh urgent    # See what needs attention
```

## Git Workflow (Linear ↔ GitHub Integration)

**Always use Linear-derived branch names** to enable automatic issue status tracking.

### Getting the Branch Name
```bash
{baseDir}/scripts/linear.sh branch MED-212
# Returns: manuel/med-212-pass-correct-terminology-year-for-verification-code
```

### Creating a Worktree for an Issue
```bash
# 1. Get the branch name from Linear
BRANCH=$({baseDir}/scripts/linear.sh branch MED-212)

# 2. Pull fresh main first (main should ALWAYS match origin)
cd /path/to/main/repo
git checkout main && git pull origin main

# 3. Create worktree with that branch (branching from fresh origin/main)
git worktree add .worktrees/med-212 -b "$BRANCH" origin/main
cd .worktrees/med-212

# 4. Do your work, commit, push
git push -u origin "$BRANCH"
```

**⚠️ Never modify files on main.** All changes happen in worktrees only.

### Why This Matters
- Linear's GitHub integration tracks PRs by branch name pattern
- When you create a PR from a Linear branch, the issue **automatically moves to "In Review"**
- When the PR merges, the issue **automatically moves to "Done"**
- Manual branch names break this automation
- Keeping main clean = no accidental pushes, easy worktree cleanup

### Quick Reference
```bash
# Full workflow example
ISSUE="MED-212"
BRANCH=$({baseDir}/scripts/linear.sh branch $ISSUE)

# Always start from fresh main
cd ~/workspace/medmatic/coding_pipeline
git checkout main && git pull origin main

# Create worktree (inside .worktrees/)
git worktree add .worktrees/${ISSUE,,} -b "$BRANCH" origin/main
cd .worktrees/${ISSUE,,}

# ... make changes ...
git add -A && git commit -m "fix: implement $ISSUE"
git push -u origin "$BRANCH"
gh pr create --title "$ISSUE: <title>" --body "Closes $ISSUE"
```

## Priority Levels

| Level | Value | Use for |
|-------|-------|---------|
| urgent | 1 | Production issues, blockers |
| high | 2 | This week, important |
| medium | 3 | This sprint/cycle |
| low | 4 | Nice to have |
| none | 0 | Backlog, someday |

## Teams & IDs (cached)

- **MED** (Medicoda): 2b0f15e8-f6b9-4dd2-a3c9-1a48c8a077c3
- ~~ONC (Oncomatic)~~: Deprecated, no longer in use

## ⚠️ Safety Rules

1. **Never edit/update issues without Manuel's explicit approval** — read-only by default
2. Focus on **MED team only** — ONC is legacy/irrelevant
3. Creating new issues is OK when asked
4. Commenting is OK for notes/updates

## Notes

- Uses GraphQL API (api.linear.app/graphql)
- Requires `LINEAR_API_KEY` env var
- Issue identifiers are like `MED-123`
