---
summary: "Claude Code integration: start and manage Claude Code sessions via chat"
read_when:
  - Starting Claude Code sessions from chat
  - Managing project aliases
---
# Claude Code

Start and manage [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions directly from chat.

## Quick start

```
/claude juzi implement the auth system     # Start with task (DyDo plans first)
/claude juzi @experimental fix the bug     # Start in worktree with task
/claude juzi --quick fix the typo          # Quick mode (bypass DyDo planning)
/claude juzi                               # Interactive session (no task)
/claude status                             # Show active sessions
/claude cancel abc123                      # Cancel session by token
```

## Project resolution

Projects are resolved in this order:

1. **Absolute paths** (starts with `/`)
2. **Registered aliases** (from config)
3. **Auto-discovered** (from search directories)

### Absolute paths

```
/claude /Users/dydo/Documents/agent/myproject
```

### Registered aliases

Register custom project names:

```
/claude register acme /work/clients/acme/main-app
/claude acme  # Uses the registered path
```

### Worktrees

Use `@` to specify a git worktree:

```
/claude juzi @experimental
```

This looks for `.worktrees/experimental` inside the project directory.

## Commands

### Start a Session

```
/claude <project> <task>
```

Start a Claude Code session with a task. DyDo analyzes the task first, then launches Claude Code with an enriched prompt.

**Examples:**
```
/claude juzi implement the auth system
/claude juzi @experimental fix the login bug
/claude clawdbot add dark mode support
```

### Quick Mode

```
/claude <project> --quick <task>
```

Skip DyDo planning and send the task directly to Claude Code.

**Examples:**
```
/claude juzi --quick fix the typo in README
/claude clawdbot --quick run the tests
```

### Interactive Session

```
/claude <project>
```

Start an interactive session without a specific task.

**Examples:**
```
/claude juzi
/claude clawdbot
```

### Resume Session

```
/claude resume <token> [task]
```

Resume a previous session. Token can be the full UUID or just the first few characters.

**Examples:**
```
/claude resume 66a15def-b044-4927-8c16-6d5e477e0fe2
/claude resume 66a15def continue the work
/claude resume 66a15 fix the remaining tests
```

### Send Message to Running Session

```
/claude say <token> <message>
```

Send a message or instruction to an active session.

**Examples:**
```
/claude say 66a15 use TypeScript instead
/claude say 66a15def please also add error handling
```

### Cancel Session

```
/claude cancel <token>
```

**Examples:**
```
/claude cancel 66a15
/claude cancel 66a15def-b044-4927-8c16-6d5e477e0fe2
```

### Status and Listing

```
/claude status      # Show active sessions
/claude list        # Same as status
```

### Project Management

```
/claude projects                        # List known projects
/claude register <name> <path>          # Register alias
/claude unregister <name>               # Remove alias
```

**Examples:**
```
/claude projects
/claude register myapp ~/projects/my-app
/claude unregister myapp
```

### Reply to Bubble

Reply to any bubble message with new instructions - the session will resume with your text as the new prompt. This works even after the session has ended.

| Command | Description |
|---------|-------------|
| `/claude <project> <task>` | Start session with task (DyDo planning) |
| `/claude <project> --quick <task>` | Quick mode (no DyDo planning) |
| `/claude <project>` | Interactive session |
| `/claude resume <token> [task]` | Resume previous session |
| `/claude say <token> <msg>` | Send message to session |
| `/claude cancel <token>` | Cancel a session |
| `/claude status` | Show active sessions |
| `/claude projects` | List known projects |
| `/claude register <name> <path>` | Register project alias |
| `/claude unregister <name>` | Remove project alias |

## Configuration

Add to `clawdbot.json`:

```json5
{
  claudeCode: {
    // Additional directories to scan for projects (searched first)
    projectDirs: [
      "~/work/clients",
      "~/repos"
    ],
    // Explicit project aliases (take priority over auto-discovery)
    projects: {
      acme: "/work/clients/acme/main-app",
      exp: "~/Documents/agent/juzi/.worktrees/experimental"
    },
    // Default permission mode: "default" | "acceptEdits" | "bypassPermissions"
    permissionMode: "bypassPermissions",
    // Default model for Claude Code sessions
    model: "opus"
  }
}
```

### Default search directories

When no `projectDirs` are configured, these directories are searched:

- `~/clawd/projects`
- `~/Documents/agent`
- `~/projects`
- `~/code`
- `~/dev`

Config directories are searched first, then defaults.

## Session status (Telegram)

On Telegram, sessions show a live status bubble with:

- Current phase/status
- Runtime
- **Continue** / **Cancel** buttons

The bubble updates automatically as the session progresses.

## Message forwarding

Session activity is forwarded to chat with emoji indicators:

- **🐶** User/DyDo messages
- **💬** Claude Code responses
- **▸** Tool in progress (reading, writing, running)
- **✓** Tool completed

This lets you follow the conversation between DyDo and Claude Code in real-time.

## Interacting with Sessions

### Chiming in

To send a message to an active session (e.g., provide context or instructions):

```
/claude say abc123 Please also add error handling
```

Where `abc123` is the first 8 characters of the session token (shown in status bubble).

### Reply to Bubble

Alternatively, just **reply to any bubble message** with new instructions. This works:

- While the session is running (sends your text as input)
- After the session has ended (resumes the session with your text as the new prompt)

This is the easiest way to give follow-up instructions.

## Runtime limits

Sessions automatically pause after **3 hours** to prevent runaway execution. When paused:

1. A warning message is sent to chat
2. Use the **Continue** button to resume (resets the timer)
3. Or use `/claude cancel <token>` to stop

## Notes

- Sessions run in `bypassPermissions` mode by default (no permission prompts)
- Only authorized senders can use `/claude`
- Use `/claude projects` to see all known projects and search directories
- **DyDo automatically answers Claude Code questions** - no user intervention needed
- Reply to bubble messages to give new instructions at any time
- Token prefixes work (e.g., `66a15` instead of `66a15def-b044-4927-8c16-6d5e477e0fe2`)
