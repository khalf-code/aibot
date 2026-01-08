# Troubleshooting

## Tests Timeout
Tests hanging or taking >30 seconds usually means stuck processes or port conflicts.

```bash
pgrep -f clawdbot          # Check for stuck gateway processes
pkill -f clawdbot          # Kill them
lsof -i :8080              # Check if port is in use
```

## E2E "Connection Refused"
Gateway not running. The `/e2e` command spawns it automatically via `pnpm test:e2e`.

If running manually, ensure gateway is started first.

## Worktree Conflicts
"Branch already checked out" errors occur when multiple agents try to use the same branch.

```bash
git worktree list          # See all worktrees
git worktree remove <path> # Remove a stuck worktree
```

Each agent should have its own worktree under `.worktrees/`.

## Lint Fails
Biome formatting issues can often be auto-fixed.

```bash
pnpm format                # Auto-fix formatting
pnpm lint                  # See remaining issues
```

**Explore:** `biome.json` for lint rules.
