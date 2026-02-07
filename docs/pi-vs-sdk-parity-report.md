# Pi Embedded Agent vs Claude Agent SDK Runtime — Parity Report

## Executive Summary

The Pi Embedded Agent and the Claude Agent SDK Runtime share the same `AgentRuntime`
interface at the top level, but the SDK runtime is significantly behind on feature
parity. This audit identified **6 critical gaps**, **7 moderate gaps**, and
**5 minor/architectural differences**. The most impactful gaps are:

1. **Skills are not available** in the SDK runtime
2. **No bootstrap/internal hooks** are triggered
3. **No messaging channel context** is forwarded

---

## 1. System Callbacks & Events

### Shared (Parity Achieved)

| Callback | Pi Location | SDK Location |
|----------|------------|--------------|
| `onPartialReply` | `pi-embedded-runner/run/params.ts:93` | `claude-agent-sdk/sdk-runner.types.ts:128` |
| `onAssistantMessageStart` | `pi-embedded-runner/run/params.ts:94` | `claude-agent-sdk/sdk-runner.types.ts:131` |
| `onBlockReply` | `pi-embedded-runner/run/params.ts:95-102` | `claude-agent-sdk/sdk-runner.types.ts:134` |
| `onToolResult` | `pi-embedded-runner/run/params.ts:107` | `claude-agent-sdk/sdk-runner.types.ts:137` |
| `onAgentEvent` | `pi-embedded-runner/run/params.ts:108` | `claude-agent-sdk/sdk-runner.types.ts:140` |

### Payload Type Difference

The SDK callbacks use `AgentRuntimePayload` (a generic type) whereas the Pi callbacks
use inline `{ text?: string; mediaUrls?: string[] }`. The Pi `onBlockReply` also
carries **additional fields**: `audioAsVoice`, `replyToId`, `replyToTag`,
`replyToCurrent` (`run/params.ts:95-102`). The SDK's `AgentRuntimePayload` does not
carry these channel-specific reply targeting fields.

### Missing from SDK Runtime

| Callback/Feature | Pi Location | Purpose |
|------------------|-------------|---------|
| `onBlockReplyFlush` | `run/params.ts:103` | Flush pending block replies before tool execution |
| `onReasoningStream` | `run/params.ts:106` | Stream reasoning/thinking text separately |
| `blockReplyBreak` | `run/params.ts:104` | Control when to flush block replies |
| `blockReplyChunking` | `run/params.ts:105` | Custom chunking strategy |
| `emitReasoningInBlockReply` | `pi-embedded-subscribe.types.ts:24` | Prefix reasoning to block replies inline |
| `enforceFinalTag` | `run/params.ts:114` | Enforce final answer tag formatting |
| `shouldEmitToolResult` | `run/params.ts:91` | Filter controlling tool result emission |
| `shouldEmitToolOutput` | `run/params.ts:92` | Filter controlling tool output emission |

---

## 2. Internal Hooks & Lifecycle Events

### Pi Runner Internal Hooks

| Hook | Trigger Location | Purpose |
|------|-----------------|---------|
| `agent:bootstrap` | `bootstrap-hooks.ts:28` | Modify bootstrap files before session start |
| `agent:precompact` | `pi-embedded-subscribe.handlers.lifecycle.ts:50` | Pre-compaction event with context metrics |
| `agent:compaction:end` | `pi-embedded-subscribe.handlers.lifecycle.ts:88` | Post-compaction event with retry info |
| `session:compaction_summary` | `pi-embedded-runner/compact.ts:469` | Token metrics after session compaction |

### SDK Hook System (Different Architecture)

The SDK uses Claude Code's native hook system (`sdk-hooks.ts:30-41`) with 11 event
types: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`,
`SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop`, `SubagentStart`,
`SubagentStop`, `PreCompact`.

**These are structurally different** from the Pi runner's `triggerInternalHook` system.
The SDK hooks emit events via `emitEvent()` but **never call `triggerInternalHook()`**.

### Parity Table

| Internal Hook | Pi Runner | SDK Runtime | Status |
|--------------|-----------|-------------|--------|
| `agent:bootstrap` | Yes | **No** | **CRITICAL GAP** |
| `agent:precompact` | Yes | Partially (emits event only) | **GAP** |
| `agent:compaction:end` | Yes | **No** | **GAP** |
| `session:compaction_summary` | Yes | **No** | **GAP** |
| Bootstrap file loading | Yes | **No** | **CRITICAL GAP** |
| Memory feedback config | Yes (`run.ts:121-124`) | **No** | **GAP** |

---

## 3. Skills Availability

**CRITICAL GAP**: The SDK runtime receives **no skills information** at all.

### Pi Runner Skills Pipeline

1. `loadWorkspaceSkillEntries()` — loads from bundled + extra + workspace + managed dirs (`skills/workspace.ts:99-154`)
2. `applySkillEnvOverrides()` — applies per-skill env vars (`skills/env-overrides.ts`)
3. `resolveSkillsPromptForRun()` — formats skills for injection (`skills/workspace.ts:256`)
4. `buildEmbeddedSystemPrompt({ skillsPrompt })` — includes skills in system prompt (`system-prompt.ts:17-108`)

### SDK Runtime

- `extraSystemPrompt` is passed directly to `sdkOptions.systemPrompt` (`sdk-runner.ts:546-548`)
- **No skill loading, no skill prompt formatting, no skill env overrides**
- The `skillsSnapshot` field exists in `runtimeHints` (`execution/types.ts:271`) but is **never consumed** by the SDK path

---

## 4. Working Directory Configuration

### Pi Runner

- Resolves workspace: `resolveUserPath(params.workspaceDir)` (`run.ts:99`)
- Saves previous cwd: `const prevCwd = process.cwd()` (`run.ts:100`)
- Changes to workspace: `process.chdir(effectiveWorkspace)` (`attempt.ts:198`)
- Restores on exit: `process.chdir(prevCwd)` in finally block (`attempt.ts:1005`)
- Session file stores cwd: `header.cwd = params.cwd` (`session-manager-init.ts:39`)

### SDK Runtime

- Passes cwd to SDK: `sdkOptions.cwd = params.workspaceDir` (`sdk-runner.ts:498`)
- Hook context carries cwd: `SdkHookContext.cwd` (`sdk-hooks.ts:46`)
- **Does NOT change process.cwd()** — the SDK subprocess handles its own cwd
- **Does NOT save/restore** working directory (stateless design)

**Assessment**: This is an **architectural difference**, not necessarily a gap. The SDK
delegates cwd management to the spawned Claude Code subprocess. However, tools executed
via MCP bridge run in-process and may need the correct cwd set.

---

## 5. Messaging & Routing Context

**CRITICAL GAP**: The SDK runtime has no messaging channel awareness.

### Pi Runner Receives

| Parameter | Location | Purpose |
|-----------|----------|---------|
| `messageChannel` | `run/params.ts:34` | Channel type (telegram, discord, etc.) |
| `messageProvider` | `run/params.ts:35` | Provider identifier |
| `messageTo` | `run/params.ts:38` | Delivery target for routing |
| `messageThreadId` | `run/params.ts:40` | Thread/topic for reply routing |
| `groupId` | `run/params.ts:42` | Group-level tool policy |
| `groupChannel` | `run/params.ts:44` | Channel label |
| `groupSpace` | `run/params.ts:46` | Guild/team ID |
| `spawnedBy` | `run/params.ts:48` | Parent session for subagent policy |
| `senderId` | `run/params.ts:49` | Sender identity |
| `senderName` | `run/params.ts:50` | Sender display name |
| `senderUsername` | `run/params.ts:51` | Sender username |
| `senderE164` | `run/params.ts:52` | Sender phone number |
| `senderIsOwner` | `run/params.ts:54` | Owner privilege flag |
| `ownerNumbers` | `run/params.ts:113` | Owner phone list |
| `replyToMode` | `run/params.ts:60` | Slack auto-threading mode |
| `currentChannelId` | `run/params.ts:56` | Slack channel for threading |

### SDK Runtime

**None of the above.** This means tool policies cannot be resolved per-channel/group,
messaging tool cannot route replies correctly, owner-only restrictions cannot be
enforced, and Slack threading does not work.

---

## 6. Tool Support

| Tool Type | Pi Runner | SDK Runtime |
|-----------|-----------|-------------|
| Clawdbrain tools (standard) | Yes, directly | Yes, via MCP bridge |
| Extension tools (`extraTools`) | Yes (`run/params.ts:116`) | **No** |
| Client tools (`clientTools`) | Yes (`run/params.ts:75`) | **No** |
| Built-in Claude Code tools | N/A | Yes (`builtInTools` param) |
| Tool policy filtering | Yes (channel/group/sender-aware) | Partial (pre-filtered only) |

---

## 7. Queue & Concurrency Management

| Feature | Pi Runner | SDK Runtime |
|---------|-----------|-------------|
| `lane` parameter | Yes (`run/params.ts:109`) | **No** |
| `enqueue` function | Yes (`run/params.ts:110`) | **No** |
| Session lane queuing | Yes (`run.ts:80-85`) | **No** |
| Global lane queuing | Yes (`run.ts:82-83`) | **No** |

---

## Proposals

### Proposal 1: Inject Skills into SDK System Prompt

**Severity**: Critical | **Effort**: Medium | **Impact**: High

**Problem**: Users on SDK runtime lose access to all workspace, bundled, and managed skills.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner-adapter.ts` — add skill loading before `runSdkAgent()`
- `src/agents/claude-agent-sdk/sdk-runner.types.ts` — add `skillsPrompt?: string`
- `src/agents/claude-agent-sdk/sdk-runner.ts` — prepend skills prompt to system prompt

**Approach**: In `sdk-runner-adapter.ts`, call `loadWorkspaceSkillEntries()`,
`resolveSkillsPromptForRun()`, and `applySkillEnvOverrides()` before passing
the composed system prompt to `runSdkAgent()`.

---

### Proposal 2: Trigger Bootstrap Hooks in SDK Path

**Severity**: Critical | **Effort**: Low-Medium | **Impact**: High

**Problem**: The `agent:bootstrap` internal hook never fires for SDK runs. Extensions
that modify bootstrap files have no effect.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner-adapter.ts` — call `resolveBootstrapContextForRun()`

**Approach**: Call the existing `resolveBootstrapContextForRun()` function and prepend
the bootstrap context to the system prompt.

---

### Proposal 3: Forward Messaging Channel Context to SDK

**Severity**: Critical | **Effort**: Medium-High | **Impact**: High

**Problem**: The SDK runtime has no concept of messaging channels, sender identity,
or routing. Multi-channel features are broken.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner.types.ts` — add `SdkMessagingContext` type
- `src/agents/claude-agent-sdk/sdk-runner-adapter.ts` — accept and forward context
- `src/execution/executor.ts` — pass context when creating SDK adapter

**Approach**: Add a `messagingContext` object to `SdkRunnerParams` and inject it into
the system prompt and/or tool execution context.

---

### Proposal 4: Add Missing Streaming Callbacks

**Severity**: Moderate | **Effort**: Medium | **Impact**: Medium

**Problem**: SDK runtime lacks `onBlockReplyFlush`, `onReasoningStream`,
`blockReplyBreak`, `blockReplyChunking`, and `emitReasoningInBlockReply`.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner.types.ts` — add callback types
- `src/agents/claude-agent-sdk/sdk-runner.ts` — implement in the event loop

**Approach**: Add boundary tracking in the Step 5 event loop to detect tool execution
start (invoke `onBlockReplyFlush`), detect reasoning content (route to
`onReasoningStream`), and add chunking around `onBlockReply` calls.

---

### Proposal 5: Support Extension and Client Tools in SDK Runtime

**Severity**: Moderate | **Effort**: Medium | **Impact**: Medium

**Problem**: Extension tools and client tools are not supported in SDK runtime.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner.types.ts` — add tool params
- `src/agents/claude-agent-sdk/tool-bridge.ts` — bridge extension/client tools
- `src/agents/claude-agent-sdk/sdk-runner-adapter.ts` — forward tool params

**Approach**: Extract the Pi runner's tool conversion logic (`attempt.ts:101-121`)
into a shared helper and use it in the SDK adapter before MCP bridging.

---

### Proposal 6: Add Tool Emission Filters

**Severity**: Low | **Effort**: Low | **Impact**: Low

**Problem**: SDK runtime always emits tool results; channels cannot suppress them.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner.types.ts` — add filter functions
- `src/agents/claude-agent-sdk/sdk-hooks.ts` — check filters before emitting

**Approach**: Add `shouldEmitToolResult` / `shouldEmitToolOutput` to params and
check them in the hook handlers before calling `onToolResult`.

---

### Proposal 7: Add Queue/Lane Management for SDK Runs

**Severity**: Moderate | **Effort**: Low-Medium | **Impact**: Medium

**Problem**: No session-level or global-level queuing for SDK runs.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner-adapter.ts` — wrap in lane queues

**Approach**: Mirror the Pi runner's pattern (`run.ts:80-85`) using
`resolveSessionLane()` and `resolveGlobalLane()`.

---

### Proposal 8: Initialize Memory Feedback for SDK Runtime

**Severity**: Low | **Effort**: Low | **Impact**: Low

**Problem**: Memory feedback system is never initialized for SDK runs.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-runner-adapter.ts` — call `configureMemoryFeedback()`

**Approach**: Direct port of the Pi runner's lazy init pattern (`run.ts:121-124`).

---

### Proposal 9: Bridge Internal Hooks to SDK Hook System

**Severity**: Moderate | **Effort**: Low-Medium | **Impact**: Medium

**Problem**: SDK `PreCompact` hook fires but doesn't trigger `agent:precompact`
internal hook. Extensions listening on internal hooks are silently ignored.

**Files to modify**:
- `src/agents/claude-agent-sdk/sdk-hooks.ts` — add `triggerInternalHook()` calls

**Approach**: In SDK hook handlers that map to internal hooks, also call
`triggerInternalHook()` with the equivalent internal event.

---

## Priority Matrix

| # | Proposal | Severity | Effort | Impact |
|---|----------|----------|--------|--------|
| 1 | Inject skills into SDK system prompt | **Critical** | Medium | High |
| 2 | Trigger bootstrap hooks | **Critical** | Low-Med | High |
| 3 | Forward messaging context | **Critical** | Med-High | High |
| 4 | Add missing streaming callbacks | Moderate | Medium | Medium |
| 5 | Support extension/client tools | Moderate | Medium | Medium |
| 6 | Add tool emission filters | Low | Low | Low |
| 7 | Add queue/lane management | Moderate | Low-Med | Medium |
| 8 | Initialize memory feedback | Low | Low | Low |
| 9 | Bridge internal hooks to SDK hooks | Moderate | Low-Med | Medium |
