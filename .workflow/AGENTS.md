# Agent Workflow (Local)

This doc covers dev-specific workflow. For coding standards, see root `CLAUDE.md`.

## Git Remotes

| Remote | Repository | Purpose |
|--------|------------|---------|
| `dev` | petter-b/clawdbot-dev (private) | Daily development |
| `fork` | petter-b/clawdbot (public) | PR staging |
| `upstream` | clawdbot/clawdbot | PR target only |

## Workflow

1. **Develop on `dev`**: `git push dev <branch>`
2. **PR-ready?** Push to `fork`: `git push fork <branch>`
3. **Create PR**: `gh pr create --repo clawdbot/clawdbot`

## Multi-Agent

Agents use git worktrees (`.worktrees/`). Don't switch branches.

## Where to Find Things

- Coding standards: `CLAUDE.md` (root)
- Test patterns: explore `src/**/*.test.ts`
- CLI commands: `package.json` scripts
- Slash commands: `.claude/commands/`
