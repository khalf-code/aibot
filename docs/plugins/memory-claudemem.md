---
summary: "Claude-Mem memory plugin - integrates claude-mem's persistent memory system with Moltbot"
read_when:
  - You want to use claude-mem's memory system with Moltbot
  - You want persistent context across sessions via claude-mem
---
# Memory (Claude-Mem)

The `memory-claudemem` plugin integrates [claude-mem](https://github.com/thedotmack/claude-mem) 
with Moltbot, enabling persistent memory across sessions. It syncs a `MEMORY.md` file to your 
workspace and records tool observations to claude-mem's database.

## Prerequisites

**You must install claude-mem separately before using this plugin.** The plugin uses claude-mem's 
worker service CLI, which is only available after installation.

## Installing Claude-Mem

### Option 1: Via Claude Code (Recommended)

If you have Claude Code installed, run these commands in a Claude Code session:

```
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

Then restart Claude Code. The plugin files will be installed to:
```
~/.claude/plugins/cache/thedotmack/claude-mem/<version>/
```

### Option 2: Manual Installation (Without Claude Code)

If you don't use Claude Code or want to install manually:

#### 1. Clone the repository

```bash
git clone https://github.com/thedotmack/claude-mem.git
cd claude-mem
```

#### 2. Install dependencies

```bash
# Using bun (recommended)
bun install

# Or using npm
npm install
```

#### 3. Build the plugin

```bash
bun run build
# or
npm run build
```

#### 4. Start the worker service

Claude-mem runs a background worker service:

```bash
# From the claude-mem directory
bun run worker:start

# Or directly
bun plugin/scripts/worker-service.cjs start
```

Check status:
```bash
bun run worker:status
```

The worker runs on `http://localhost:37777` by default and provides:
- Real-time memory stream UI at http://localhost:37777
- API endpoints for memory search and retrieval
- Background observation processing

#### 5. Configure Moltbot with the worker path

Tell Moltbot where to find the worker service:

```json5
{
  plugins: {
    entries: {
      "memory-claudemem": {
        enabled: true,
        config: {
          workerPath: "/path/to/claude-mem/plugin/scripts/worker-service.cjs"
        }
      }
    }
  }
}
```

Or set the slot directly:

```json5
{
  plugins: {
    slots: {
      memory: "memory-claudemem"
    },
    entries: {
      "memory-claudemem": {
        config: {
          workerPath: "/path/to/claude-mem/plugin/scripts/worker-service.cjs"
        }
      }
    }
  }
}

## Enabling the Moltbot Plugin

Once claude-mem is installed, enable the Moltbot plugin:

### Via CLI

```bash
moltbot plugins enable memory-claudemem
moltbot gateway restart
```

### Via Config

```json5
{
  plugins: {
    slots: {
      memory: "memory-claudemem"
    }
  }
}
```

Or explicitly in entries:

```json5
{
  plugins: {
    entries: {
      "memory-claudemem": {
        enabled: true,
        config: {
          syncMemoryFile: true,
          project: "my-project"  // optional, defaults to workspace dir name
        }
      }
    }
  }
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `syncMemoryFile` | boolean | `true` | Sync MEMORY.md with claude-mem context on session/gateway start |
| `project` | string | workspace dir name | Project name for scoping observations |
| `workerPath` | string | (auto-detect) | Path to `worker-service.cjs` for manual installs |

## How It Works

The plugin integrates with Moltbot's lifecycle hooks:

1. **Session Start** (`before_agent_start`)
   - Syncs `MEMORY.md` from claude-mem's context (once per session)
   - Records the user prompt via `session-init` hook

2. **Tool Usage** (`tool_result_persist`)
   - Records tool observations to claude-mem's database
   - Fire-and-forget for performance

3. **Session End** (`agent_end`)
   - Triggers claude-mem's summarize hook with the last assistant message
   - Generates session summaries for future context

4. **Gateway Start** (`gateway_start`)
   - Syncs `MEMORY.md` when Moltbot starts

## Troubleshooting

### Plugin disabled: worker-service.cjs not found

The plugin couldn't find claude-mem's worker service. Check:

1. Is claude-mem installed?
   ```bash
   ls ~/.claude/plugins/cache/thedotmack/claude-mem/
   ```

2. Does the version directory contain `scripts/worker-service.cjs`?
   ```bash
   ls ~/.claude/plugins/cache/thedotmack/claude-mem/*/scripts/worker-service.cjs
   ```

3. If installed manually, ensure you copied/linked the `plugin` directory correctly.

### MEMORY.md not updating

1. Check if the worker is running:
   ```bash
   curl http://localhost:37777/api/readiness
   ```

2. Check claude-mem logs:
   ```bash
   tail -f ~/.claude-mem/logs/worker-$(date +%Y-%m-%d).log
   ```

3. Ensure `syncMemoryFile: true` in plugin config.

### Observations not being recorded

1. Verify the worker is running and healthy
2. Check that the project name matches between Moltbot workspace and claude-mem
3. Look for errors in Moltbot gateway logs

## Using with Other Memory Plugins

This is an exclusive slot plugin. Only one memory plugin can be active at a time:

- `memory-core` (default) - Built-in vector search over workspace memory files
- `memory-lancedb` - LanceDB-backed long-term memory
- `memory-claudemem` - Claude-mem integration (this plugin)

Set `plugins.slots.memory = "none"` to disable all memory plugins.

## Links

- [claude-mem GitHub](https://github.com/thedotmack/claude-mem)
- [claude-mem Documentation](https://docs.claude-mem.ai)
- [Moltbot Plugins](/plugin)
