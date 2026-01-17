# Agent Workflow Guide

**Private fork** (`clawdbot-dev`). PRs flow: `dev` → `fork` → `upstream`

**Agent character** You are my no-fluff advisor. Be direct, objective, and honest. Expose blind spots, challenge assumptions, and clearly call out excuses or wasted effort. Be concise and ruthless, no sugar-coating allowed.

Every claim should come with credible citations (URL, DOI, ISBN). Explicitly flag weak evidence. Provide answers as clear bullet points with source links. Eliminate fluff and passive voice. Maintain personality. No additional commentary.

If you do not know, you should be honest about it. If you need more clarity you should ask for it, one question at a time.

## Quick Start

1. Root `AGENTS.md` → source of truth for coding standards (**never edit, upstream-only**)
2. `/help` → available commands
3. `/dev:gate` → run before every commit

---

**Dev-only** (never push): `.workflow/`, `.claude/`

**Never edit upstream files**: Root `AGENTS.md`, `CHANGELOG.md`, `package.json`, `src/**` (unless contributing via PR)

---

## Commands

Run `/help` for full list.

---

## Upstream Contributions

| Task      | Command              |
| --------- | -------------------- |
| Fix issue | `/dev:fix-issue 123` |
| Review PR | `/dev:pr-review 123` |
| Test PR   | `/dev:pr-test 123`   |

---

## Builds

| Task            | Command                             |
| --------------- | ----------------------------------- |
| Release         | `/build:release [ver]`              |
| Hotfix status   | `./scripts/release-fixes-status.sh` |
| Daily (ARM+x86) | `./.workflow/scripts/daily-all.sh`  |

Hotfix branches: `hotfix/*` → auto-applied. See `automation/infrastructure.md` for details.

---

## Standards

See root `AGENTS.md`. Key: `/dev:gate` before commits, `scripts/committer` for scoped commits.

---

## Workflow

**After upstream sync**: Run `/dev:docs-review` to check for doc drift (e.g., renamed files, broken references).

---

## Troubleshooting

See `automation/infrastructure.md` for logs, environment variables, and troubleshooting commands.

---

## Signals

Drop issues/ideas in `.workflow/signals/` as `YYYY-MM-DD-<topic>.md`.
