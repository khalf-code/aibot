---
name: Git Repo Restructure
overview: Restructure git to have a single repo at /home/liam, divorce clawdbot from upstream, and document the process for selectively importing upstream updates.
todos:
  - id: create-gitignore
    content: Create .gitignore with sensible exclusions for caches, secrets, large files
    status: completed
  - id: divorce-clawdbot
    content: Remove /home/liam/clawdbot/.git to divorce from upstream
    status: completed
  - id: create-upstream-docs
    content: Create clawd/UPSTREAM-SYNC.md with sync documentation
    status: completed
  - id: initial-commit
    content: Stage important files and create initial commit
    status: completed
  - id: verify-git-status
    content: Verify single repo structure is working correctly
    status: completed
isProject: false
---

# Git Repository Restructure Plan

## TL;DR

Convert Liam's home directory into a single git repository, divorce clawdbot from upstream GitHub, and create documentation for selectively importing upstream updates.

## Current State

- `/home/liam/.git` - Empty repo, no commits
- `/home/liam/clawdbot/.git` - Full repo tracking `github.com/clawdbot/clawdbot.git` (58 commits behind)

## Target State

- `/home/liam/.git` - Single repo tracking all of Liam's customized setup
- `/home/liam/clawdbot/` - Just a folder (no .git), fully customizable
- `/home/liam/clawd/UPSTREAM-SYNC.md` - Documentation for importing upstream updates

## Implementation

### Step 1: Create .gitignore

Create `/home/liam/.gitignore` with sensible exclusions:

```gitignore
# Caches and temp files
.cache/
.npm/
.ollama/
node_modules/
*.log
/tmp/

# Editor/IDE
.cursor-server/
.vscode/

# Secrets (tracked separately or encrypted)
.clawdbot/credentials/
.ssh/

# Large binary downloads
clawdbot/downloads/
clawdbot/models/

# Session data (regenerated)
.clawdbot/agents/*/sessions/*.jsonl

# Shell history
.bash_history
.wget-hsts
```

### Step 2: Divorce clawdbot from upstream

```bash
rm -rf /home/liam/clawdbot/.git
```

This removes the connection to `github.com/clawdbot/clawdbot.git`.

### Step 3: Initial commit

```bash
cd /home/liam
git add .gitignore
git add clawd/
git add clawdbot/
git add .clawdbot/clawdbot.json
git add .clawdbot/cron/
git add .profile
git add .gitconfig
git commit -m "Initial commit: Liam's customized clawdbot setup

- Divorced from upstream clawdbot/clawdbot.git
- Includes all custom skills, config, and identity files
- See clawd/UPSTREAM-SYNC.md for importing upstream updates"
```

### Step 4: Create upstream sync documentation

Create `/home/liam/clawd/UPSTREAM-SYNC.md`:

```markdown
# Syncing with Upstream Clawdbot

This Liam instance is **divorced** from the official clawdbot repository.
We customize freely without worrying about upstream conflicts.

## When to Sync

Consider syncing when:
- New features announced you want
- Security patches released
- Bug fixes for issues you're experiencing

## How to Import Upstream Updates

### Method 1: Cherry-pick specific commits (Recommended)

1. Clone upstream to a temp directory:
   ```bash
   cd /tmp
   git clone --depth=50 https://github.com/clawdbot/clawdbot.git clawdbot-upstream
   cd clawdbot-upstream
   ```

2. Find the commit(s) you want:
   ```bash
   git log --oneline -20
   # Note the commit hash(es) you want
   ```

3. Generate a patch:
   ```bash
   git format-patch -1 <commit-hash> --stdout > /tmp/upstream-patch.patch
   ```

4. Review and apply to your Liam:
   ```bash
   cd /home/liam/clawdbot
   patch -p1 --dry-run < /tmp/upstream-patch.patch  # Preview
   patch -p1 < /tmp/upstream-patch.patch            # Apply
   ```

5. Commit the changes:
   ```bash
   cd /home/liam
   git add clawdbot/
   git commit -m "Import upstream: <description of what you imported>"
   ```

6. Cleanup:
   ```bash
   rm -rf /tmp/clawdbot-upstream /tmp/upstream-patch.patch
   ```

### Method 2: Diff and manually merge

1. Clone upstream:
   ```bash
   cd /tmp
   git clone --depth=1 https://github.com/clawdbot/clawdbot.git clawdbot-upstream
   ```

2. Diff specific files:
   ```bash
   diff -u /home/liam/clawdbot/src/gateway/index.ts /tmp/clawdbot-upstream/src/gateway/index.ts
   ```

3. Manually copy the changes you want.

### Method 3: Full upstream comparison (for major updates)

1. Clone upstream:
   ```bash
   cd /tmp
   git clone https://github.com/clawdbot/clawdbot.git clawdbot-upstream
   ```

2. Use a diff tool:
   ```bash
   diff -rq /home/liam/clawdbot/src /tmp/clawdbot-upstream/src | grep -v node_modules
   ```

3. Review each changed file and decide what to import.

## Files to NEVER overwrite from upstream

These contain Liam-specific customizations:

- `skills/` - Our custom skills
- Any file you've modified for Liam's specific needs

## Tracking what you've imported

Add a note to this file when you import updates:

### Import Log

| Date | Upstream Commit | Description |
|------|-----------------|-------------|
| 2026-01-25 | (initial) | Divorced at commit 6a9301c27 |
```

## Files Involved

- `/home/liam/.gitignore` - NEW
- `/home/liam/clawdbot/.git` - REMOVE
- `/home/liam/clawd/UPSTREAM-SYNC.md` - NEW
- Various files added to git tracking

## APEX Compliance Notes

- **Read First**: Checked current git state before planning
- **Non-Destructive**: Original clawdbot code preserved, only .git removed
- **Documentation**: Full upstream sync process documented
- **Rollback Path**: Can re-clone upstream if needed
- **Single Source of Truth**: One repo, clear ownership
