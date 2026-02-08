# Context Pruning (Two-Phase Compaction)

When a session's context grows large, OpenClaw runs a two-phase compaction to reclaim space before the context window fills up.

## How it works

### Phase 1: Prune (cheap, no LLM call)

Old tool outputs (file reads, bash results, grep output, etc.) are replaced with a short placeholder. This is fast and preserves the conversation structure and cache.

The pruner walks backwards through the message history and:

1. **Protects the last 2 user turns** — all tool results within the most recent two user messages are never touched.
2. **Stops at summary boundaries** — if a previous compaction summary exists, the pruner does not look beyond it.
3. **Protects the most recent 40K tokens of tool output** — even outside the 2-turn window, recent tool results are kept intact.
4. **Marks everything older for pruning** — tool outputs beyond the 40K protect window are replaced with `"[output pruned for context]"`.
5. **Skips protected tools** — outputs from `skill`, `memory_search`, and `gandiva_recall` are never pruned (these are the built-in defaults; you can add more via config).
6. **Minimum threshold** — pruning only triggers if at least 20K tokens would be removed, avoiding churn on small savings.

If pruning alone brings the context below 80% of the model's context window, the process stops here. No LLM call is made.

### Phase 2: Summarize (expensive, LLM call)

If the context is still over 80% after pruning, OpenClaw calls the LLM to generate a summary of older messages. This is the traditional compaction step — it produces a condensed summary and drops the original messages.

The summarization pipeline works as follows:

1. **Split into stages** (`summarizeInStages`) — the messages to be summarized are split into N parts (default 2) by token share, so each part fits within model limits.

2. **Summarize each part** (`summarizeWithFallback`) — each part goes through a three-tier attempt:
   - **Full summarization**: chunk all messages by `maxChunkTokens`, then call the LLM (`generateSummary`) sequentially on each sub-chunk. The previous sub-chunk's summary is fed forward as rolling context, so the LLM builds an incremental picture.
   - **Fallback 1 (partial)**: if full summarization fails (e.g. a single message is too large), filter out oversized messages (>50% of context window), summarize just the smaller ones, and append notes like `[Large toolResult (~15K tokens) omitted from summary]`.
   - **Fallback 2 (give up)**: if partial summarization also fails, return a plain note: `"Context contained 12 messages (3 oversized). Summary unavailable due to size limits."`.

3. **Merge partial summaries** — if the messages were split into multiple parts, the resulting partial summaries are fed back into the LLM with the instruction: *"Merge these partial summaries into a single cohesive summary. Preserve decisions, TODOs, open questions, and any constraints."* This produces a single unified summary.

4. **Replace and verify** — the summary replaces the old messages in the session. `tokensAfter` is re-estimated and sanity-checked (must be less than `tokensBefore`; if not, the estimate is discarded).

## Configuration

All prune settings live under `agents.defaults.compaction` in `clawdbot.json`:

```json
{
  "agents": {
    "defaults": {
      "compaction": {
        "prune": true,
        "pruneProtectTokens": 40000,
        "pruneMinimumTokens": 20000,
        "pruneProtectedTools": ["my_custom_tool"]
      }
    }
  }
}
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `prune` | `boolean` | `true` | Enable/disable the prune phase entirely. Set to `false` to skip straight to LLM summarization. |
| `pruneProtectTokens` | `number` | `40000` | Tokens of recent tool output to protect from pruning. |
| `pruneMinimumTokens` | `number` | `20000` | Minimum prunable tokens required to trigger pruning. Prevents churn when savings would be small. |
| `pruneProtectedTools` | `string[]` | `[]` | Additional tool names to protect from pruning. These are merged with the built-in defaults (`skill`, `memory_search`, `gandiva_recall`). |

### Built-in protected tools

These tool outputs are never pruned regardless of age or token count:

- `skill` — skill execution results
- `memory_search` — vector memory search results
- `gandiva_recall` — recall results

To add your own, list them in `pruneProtectedTools`. They are additive — you cannot accidentally remove the built-in protections.

## Source

- Prune logic: `src/agents/compaction.ts` (`pruneToolOutputs`)
- Call site: `src/agents/pi-embedded-runner/compact.ts` (Phase 1 + Phase 2 orchestration)
- Config types: `src/config/types.agent-defaults.ts` (`AgentCompactionConfig`)
- Tests: `src/agents/compaction.prune.test.ts`
