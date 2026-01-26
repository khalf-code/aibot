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

- `skills/` - Our custom skills (github-monitor, kroko-voice, para-tasks, visual-timer, etc.)
- `docs/` - Any custom documentation
- Any config files you've modified for Liam's specific needs

## Tracking what you've imported

Add a note to this file when you import updates:

### Import Log

| Date | Upstream Commit | Description |
|------|-----------------|-------------|
| 2026-01-25 | 6a9301c27 | Divorced at this commit (v2026.1.24-0) |
