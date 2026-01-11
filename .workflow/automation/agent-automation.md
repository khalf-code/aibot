# Multi-Agent Automation

## Implemented

### Claude Code Configuration

Settings in `.claude/settings.json`:
- **Allow**: `pnpm`, `bun`, safe git commands, `scripts/committer`
- **Deny**: `rm -rf /`, `git push --force`, `git stash`, `git checkout`

Hook in `.claude/hooks/pre-bash.sh`:
- Blocks dangerous patterns (force push, stash, branch switching)
- Enforces multi-agent safety from root `AGENTS.md`

### Slash Commands

See `/dev:help` or `.workflow/AGENTS.md` for command reference.

### Skills

| Skill | Purpose |
|-------|---------|
| `writing-tests` | TDD patterns |
| `e2e-testing` | E2E test patterns |
| `reviewing-code` | Code review checklists |

---

## Multi-Agent Safety

See root `AGENTS.md` (source of truth).

---

## Adding Commands/Hooks

**New slash command**:
```bash
# .claude/commands/dev/<name>.md
---
description: Brief description
allowed-tools: Bash, Read
---
Instructions here. Args: $ARGUMENTS
```

**Hook events**: `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `Stop`
