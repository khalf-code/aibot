# Infrastructure

## Worktrees

`./.workflow/scripts/setup-worktrees.sh [dir]` → creates `agent-{dev,test,review}` worktrees.

## tmux

Socket: `${TMPDIR}/clawdbot-tmux-sockets/clawdbot.sock`

## Daily Builds

| Script | Target |
|--------|--------|
| `./.workflow/scripts/daily-all.sh` | ARM + x86 parallel |
| `./.workflow/scripts/daily-build.sh` | ARM (local) |
| `./.workflow/scripts/daily-build-k8s.sh` | x86 (k8s) |

Results: `~/.clawdbot/daily-builds/summary-$(date +%Y-%m-%d).log`

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CLAWDBOT_CONFIG_PATH` | Config file location |
| `CLAWDBOT_GATEWAY_URL` | Gateway WebSocket URL |
| `CLAWDBOT_GATEWAY_PORT` | Gateway port |
| `CLAWDBOT_TMUX_SOCKET_DIR` | tmux socket directory |
| `CLAWDBOT_SKIP_PROVIDERS` | Skip provider init (testing) |
| `CLAWDBOT_ENABLE_BRIDGE_IN_TESTS` | Enable bridge (testing) |

---

## Log Locations

| Log | Location |
|-----|----------|
| Gateway | stdout/stderr |
| Sessions | `~/.clawdbot/agents/main/sessions/*.jsonl` |
| Agent | `~/.claude/session.log` |
| macOS unified | `./scripts/clawlog.sh --follow` |

---

## Fork Safety

| Script | Purpose |
|--------|---------|
| `./.workflow/scripts/audit-fork-config.sh` | Validate fork configuration |

Run before upstream syncs to ensure `.gitattributes` merge=ours only protects fork-only files.

---

## Troubleshooting

```bash
pgrep -f clawdbot && pkill -f clawdbot    # Stuck processes
lsof -i :8080                             # Port conflicts
git worktree list                         # Worktree issues
pnpm format                               # Lint auto-fix
tailscale status                          # Network check
ls -la ${TMPDIR}/clawdbot-tmux-sockets/   # tmux sockets
tmux -S $SOCKET kill-server               # Reset tmux
./.workflow/scripts/audit-fork-config.sh  # Validate fork config
```

