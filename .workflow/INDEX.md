# Workflow Documentation

> **Purpose**: Meta-documentation for AI agents working in `clawdbot-dev`.
> Entry point: `.claude/CLAUDE.md` (Claude Code reads this automatically)

## Repo Structure

```
clawdbot-dev (private)  →  clawdbot (public fork)  →  upstream
    dev + testing              PR staging              anthropic/clawdbot
```

Development happens here. Only PR-ready code goes to the public fork.

## Directory Structure

```
.claude/
├── CLAUDE.md               # Entry point with progressive disclosure triggers
├── settings.json           # Permissions and hooks configuration
├── commands/               # Slash commands
│   ├── gate.md             # /gate - Quality gate (lint, build, test)
│   ├── test.md             # /test - Run tests
│   ├── e2e.md              # /e2e - E2E tests
│   ├── commit.md           # /commit - Safe commit
│   ├── tdd.md              # /tdd - TDD workflow
│   └── coverage.md         # /coverage - Coverage analysis
└── hooks/
    └── pre-bash.sh         # Pre-bash validation hook

.workflow/
├── INDEX.md                # This file
├── contributing/
│   ├── tdd-workflow.md     # Test-Driven Development practices
│   └── e2e-testing.md      # End-to-end test patterns
└── automation/
    ├── agent-automation.md # Multi-agent coordination
    └── infrastructure.md   # Mac mini + k3s + Tailscale setup
```

## Quick Start: Slash Commands

Available slash commands for TDD workflow:

```bash
/gate              # Run quality gate (lint, build, test)
/test [pattern]    # Run tests (--coverage for coverage)
/e2e [pattern]     # Run E2E tests
/commit "msg" ...  # Safe commit using scripts/committer
/tdd red|green|refactor [feature]  # TDD workflow phases
/coverage [path]   # Analyze test coverage
```

## When to Read What

| Trigger | Document |
|---------|----------|
| Writing or reviewing tests | `contributing/tdd-workflow.md` |
| Writing E2E tests | `contributing/e2e-testing.md` |
| Setting up multi-agent workflows | `automation/agent-automation.md` |
| Configuring infrastructure | `automation/infrastructure.md` |

## Exploration Principle

These docs provide **patterns and workflows**, not inventories. This repo is kept in sync with upstream.

**Explore locally first:**
- `CLAUDE.md` (root) - Current project guidelines (synced from upstream)
- `package.json` - Available commands
- `src/**/*.test.ts` - Test patterns
- `docs/` - Official documentation

## Design Principles

1. **Private dev repo**: `.workflow/` and `.claude/` live here, not in public fork
2. **Discoverable**: `.claude/CLAUDE.md` is entry point (Claude Code reads automatically)
3. **Agent-focused**: Guides AI agents on contributing quality code to upstream

## What Goes Where

| Content Type | Location | Notes |
|--------------|----------|-------|
| Upstream code + docs | `src/`, `docs/` | Synced from upstream |
| **Claude Code config** | `.claude/` | Dev repo only |
| **Workflow docs** | `.workflow/` | Dev repo only |
| Helper scripts | `scripts/setup-worktrees.sh`, etc. | Dev repo only |
| Experimental docs | `docs/local/` | Gitignored |
| **PR-ready code** | Push to public fork | For upstream submission |
