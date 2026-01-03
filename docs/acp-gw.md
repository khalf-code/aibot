# acp-gw: Gateway-backed ACP Server

`acp-gw` is a thin ACP (Agent Communication Protocol) server that delegates to a running Clawdis Gateway via WebSocket. Unlike `clawd-acp` which runs the agent in-process, `acp-gw` acts as a protocol translator — it receives ACP requests over stdio and forwards them to the Gateway.

## Usage

```bash
# Start the Gateway (in one terminal)
pnpm exec clawdis gateway --force

# Run acp-gw as an ACP agent (in another terminal)
node dist/acp-gw/server.js --verbose

# Or via the acp-client for testing
node dist/acp-client/client.js \
  --agent "node dist/acp-gw/server.js --verbose" \
  --cwd ~/clawd
```

## Architecture

```
┌─────────────┐     stdio      ┌─────────────┐    WebSocket    ┌─────────────┐
│  ACP Client │ ◄────────────► │   acp-gw    │ ◄──────────────► │   Gateway   │
│  (Claude,   │   JSON-RPC     │  (server.ts)│   chat.send     │  (server.ts)│
│   etc.)     │                │             │   + events      │             │
└─────────────┘                └─────────────┘                  └─────────────┘
```

### Components

- **`server.ts`** — CLI entry point, stdio JSON-RPC handler
- **`translator.ts`** — Converts ACP ↔ Gateway protocol (session/prompt → chat.send, chat events → session/update)
- **`session.ts`** — In-memory session manager with `acp:` prefix for isolation
- **`types.ts`** — TypeScript types for sessions and options

## Session Isolation

ACP sessions use the prefix `acp:` in their sessionKey (e.g., `acp:16ef47a0-0fb6-4796-a184-134f7f8198ff`). This:

1. Keeps ACP session history separate from main/messaging sessions
2. Allows the Gateway to route chat events to the correct ACP client
3. Enables concurrent execution (see below)

## Concurrent Execution Fix

### The Problem

Initially, ACP sessions would hang indefinitely when the main session was active. The agent would start (`state: "started"`) but never emit any events.

### Root Cause

The Gateway uses a command queue with lanes to serialize agent execution. Both the main session and ACP sessions were using `globalLane=main` with `maxConcurrent: 1`, meaning:

```
Main session running → ACP session queued → ACP session waits forever
```

### The Fix

In `src/commands/agent.ts`, ACP sessions now use their sessionKey as their lane:

```typescript
// Use sessionKey as lane to allow ACP sessions to run in parallel with main
const lane = sessionKey?.startsWith("acp:") ? sessionKey : undefined;
result = await runEmbeddedPiAgent({
  // ...
  lane,
  // ...
});
```

This means:
- Main session uses `globalLane=main`
- ACP session `acp:abc123` uses `globalLane=acp:abc123`
- Each lane has `maxConcurrent: 1`, so sessions don't interfere with each other
- Multiple ACP sessions can run concurrently with the main session

## Debugging

Use `--trace-sessions` on the gateway to see session routing:

```bash
pnpm exec clawdis gateway --force --trace-sessions
```

This logs:
- `[gateway] addChatRun` — when a chat run is registered
- `[gateway] peekChatRun` — when looking up a run by sessionId
- `[agentCommand]` — session resolution and lane assignment  
- `[pi-embedded]` — lane enqueueing and agent start

## Event Flow

1. ACP client sends `session/prompt` with prompt text
2. `acp-gw` calls Gateway `chat.send` with sessionKey=`acp:<sessionId>`
3. Gateway registers the run in `chatRunSessions` map
4. Gateway calls `agentCommand` which runs the agent in its own lane
5. Agent emits events → Gateway broadcasts them as `chat` events with sessionKey
6. `acp-gw` receives events, matches sessionKey to pending session
7. `acp-gw` sends `session/update` notifications back to ACP client
8. On `state: "final"`, resolves the prompt and returns result

## Files

```
src/acp-gw/
├── index.ts       # Exports
├── server.ts      # CLI entry point (clawd-acp-gw binary)
├── session.ts     # Session manager
├── translator.ts  # ACP ↔ Gateway protocol translation
└── types.ts       # TypeScript types
```
