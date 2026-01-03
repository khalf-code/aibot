# ACP-GW: Gateway-Backed ACP Server

## Overview

A lightweight ACP server that speaks stdio JSON-RPC to IDE clients but delegates all agent work to a running Clawdis Gateway via WebSocket. This enables remote IDE usage and unified session management.

```
┌─────────────────┐     stdio      ┌─────────────────┐    WebSocket    ┌─────────────────┐
│  IDE (Zed, VS   │ ◄───────────► │   acp-gw        │ ◄────────────► │    Gateway      │
│  Code, etc.)    │   JSON-RPC     │   (translator)  │                 │                 │
└─────────────────┘                └─────────────────┘                 └─────────────────┘
```

## Design Principles

1. **Zero Gateway changes** — uses existing RPC methods only
2. **Stateless translator** — session state lives in Gateway, acp-gw just maps protocols
3. **Parallel to clawd-acp** — new binary, doesn't replace existing implementation

## Components

### New Files

```
src/acp-gw/
├── server.ts      # stdio entry point, ACP protocol handler
├── translator.ts  # ACP ↔ Gateway protocol mapping
├── session.ts     # local session metadata (cwd, capabilities)
└── index.ts       # exports
```

### New Binary

```json
// package.json
{
  "bin": {
    "clawd-acp-gw": "dist/acp-gw/server.js"
  }
}
```

## Protocol Mapping

### ACP → Gateway

| ACP Method | Gateway RPC | Notes |
|------------|-------------|-------|
| `initialize` | (local) | Return capabilities, no Gateway call |
| `newSession({ cwd })` | (local) | Generate `acp:<uuid>`, store cwd locally |
| `prompt({ sessionId, prompt })` | `chat.send` | Map sessionId → sessionKey, subscribe to events |
| `cancel({ sessionId })` | `chat.abort` | Map sessionId → sessionKey |
| `loadSession` | `sessions.list` + local restore | Phase 2 |
| `setSessionMode` | `sessions.patch` | Map mode → thinking level |

### Gateway → ACP

| Gateway Event | ACP Event | Notes |
|---------------|-----------|-------|
| `agent { stream: "assistant", data: { text } }` | `agent_message_chunk` | Streaming text |
| `agent { stream: "tool", data: { phase: "start" } }` | `tool_call` | Tool invocation started |
| `agent { stream: "tool", data: { phase: "end" } }` | `tool_call_update` | Tool completed |
| `chat { state: "done" }` | `stopReason: "end_turn"` | Prompt complete |
| `chat { state: "aborted" }` | `stopReason: "cancelled"` | User cancelled |
| `chat { state: "error" }` | `stopReason: "error"` | Agent error |

## Session Handling

### Local State (in translator)

```typescript
type AcpGwSession = {
  sessionId: string;           // ACP session ID (UUID)
  sessionKey: string;          // Gateway session key ("acp:<uuid>")
  cwd: string;                 // Working directory from newSession
  createdAt: number;
  abortController: AbortController | null;
};
```

### Session Key Strategy

- Generate: `acp:<uuid>` 
- This matches existing session isolation in `resolveSessionKey()`
- Gateway auto-creates session on first `chat.send`

### Working Directory

The `cwd` from `newSession` is:
1. Stored locally in translator
2. Prepended to prompts as context: `[Working directory: /path/to/project]`
3. Agent's AGENTS.md / skills use this for file operations

## Implementation Plan

### Phase 1: Core Flow

1. **Entry point** (`server.ts`)
   - Parse CLI args: `--gateway-url`, `--gateway-token`, `--verbose`
   - Default to `ws://127.0.0.1:18789`
   - Create ACP AgentSideConnection over stdio
   - Instantiate translator with Gateway client

2. **Translator** (`translator.ts`)
   - Implement `Agent` interface from `@agentclientprotocol/sdk`
   - Connect to Gateway WebSocket using existing `callGateway` or raw client
   - Map ACP methods to Gateway RPC
   - Subscribe to Gateway events, reshape to ACP format

3. **Session management** (`session.ts`)
   - In-memory map of ACP sessions
   - Track cwd, abort controllers
   - No persistence (sessions live only while acp-gw runs)

### Phase 2: Streaming & Tools

4. **Event subscription**
   - After `chat.send`, subscribe to `agent` and `chat` events for that sessionKey
   - Filter events by runId to handle concurrent sessions
   - Map tool events to ACP tool_call / tool_call_update

5. **Cancellation**
   - `cancel()` → `chat.abort({ sessionKey })`
   - Clean up local abort controller

### Phase 3: Polish

6. **Error handling**
   - Gateway disconnect → reconnect with backoff
   - Timeout handling
   - Graceful shutdown

7. **Auth**
   - Pass `--gateway-token` or `--gateway-password` to Gateway calls
   - Support reading from config

8. **Testing**
   - Use existing `clawd-acp-client` to test against acp-gw
   - Integration tests with mock Gateway

## CLI Usage

```bash
# Local Gateway (default)
clawd-acp-gw

# Remote Gateway
clawd-acp-gw --gateway-url wss://my-server:18789 --gateway-token secret

# Verbose logging
clawd-acp-gw --verbose
```

## IDE Configuration

### Zed

```json
{
  "assistant": {
    "provider": "acp",
    "acp": {
      "command": "clawd-acp-gw",
      "args": ["--gateway-url", "wss://remote:18789"]
    }
  }
}
```

### VS Code (future)

```json
{
  "acp.agent.command": "clawd-acp-gw",
  "acp.agent.args": ["--gateway-url", "wss://remote:18789"]
}
```

## Differences from clawd-acp

| Aspect | clawd-acp | clawd-acp-gw |
|--------|-----------|--------------|
| Agent execution | In-process | Via Gateway |
| Gateway required | No | Yes |
| Remote capable | No | Yes |
| Session persistence | Own store | Gateway's store |
| Config loading | Direct | Via Gateway |
| Complexity | Higher (full agent) | Lower (translator only) |

## Open Questions

1. **Image attachments** — ACP supports image content blocks. Gateway's `chat.send` has `attachments`. Need to verify format compatibility.

2. **MCP servers** — ACP's `newSession` accepts `mcpServers`. Do we pass these through or ignore? Current Gateway doesn't have dynamic MCP config.

3. **Embedded context** — ACP supports `embeddedResource` content blocks. Map to attachments or inline in prompt?

## Success Criteria

- [ ] `clawd-acp-client` works against `clawd-acp-gw`
- [ ] Streaming responses display in real-time
- [ ] Tool calls show in IDE
- [ ] Cancellation works
- [ ] Works with remote Gateway over wss://
- [ ] Auth (token/password) works
