# Session Handover: TDD Workflow Setup

> **TEMPORARY DOCUMENT** - Delete this file after deploying to `clawdbot-dev`.
> This tracks the setup conversation only. Not part of the permanent workflow.

## Status

**Branch**: `claude/setup-tdd-workflow-CgvY4`
**Phase**: Ready to deploy to private dev repo

## What Was Built

- `.claude/commands/` - 6 slash commands (`/gate`, `/test`, `/e2e`, `/commit`, `/tdd`, `/coverage`)
- `.claude/settings.json` - Permissions + pre-bash hook
- `.workflow/` - Permanent workflow documentation
- `scripts/setup-worktrees.sh` - Git worktree setup for parallel agents
- `scripts/e2e-with-gateway.sh` - E2E test runner with temp gateway

## To Deploy (Two-Repo Workflow)

```bash
# 1. Create private dev repo (clawdbot-dev)
gh repo create clawdbot-dev --private
cd ~/repos  # or wherever you keep repos
git clone <clawdbot-dev-url>
cd clawdbot-dev

# 2. Add upstream as remote and pull
git remote add upstream https://github.com/anthropics/clawdbot.git
git fetch upstream
git merge upstream/main --allow-unrelated-histories

# 3. Add workflow setup from this branch
git remote add setup-source <this-repo-url>
git fetch setup-source claude/setup-tdd-workflow-CgvY4
git checkout setup-source/claude/setup-tdd-workflow-CgvY4 -- .claude/ .workflow/ scripts/setup-worktrees.sh scripts/e2e-with-gateway.sh

# 4. Delete this handover file
rm .workflow/HANDOVER.md

# 5. Commit and push
git add -A
git commit -m "feat: add TDD workflow tooling for agent development"
git push origin main

# 6. Add public fork as remote for PR submission
git remote add public-fork git@github.com:you/clawdbot.git
```

## PR Submission Workflow

```bash
# When ready to submit PR to upstream:
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Develop and test locally
/gate  # run quality gate

# 3. Push to public fork (without .claude/, .workflow/)
git push public-fork feature/my-feature

# 4. Create PR from public fork to upstream
gh pr create --repo anthropics/clawdbot
```

## Session Commits

| Commit | Description |
|--------|-------------|
| `5e58df0` | refactor: restructure workflow docs |
| `2f21a82` | feat: add slash commands, settings, hooks |
| `7848f89` | feat: add helper scripts |
| `63dd9b9` | docs: make HANDOVER.md temporary |
