---
summary: "Session pruning: tool-result trimming to reduce context bloat"
read_when:
  - You want to reduce LLM context growth from tool outputs
  - You are tuning agents.defaults.contextPruning
---
# Session Pruning

Session pruning trims **old tool results** (and, in `adaptive` mode, may condense older user/assistant messages via `midTrim`) from the in-memory context right before each LLM call. It does **not** rewrite the on-disk session history (`*.jsonl`).

## When it runs
- Before each LLM request (context hook).
- Only affects the messages sent to the model for that request.

## What can be pruned / condensed
- Tool results (`toolResult` messages) may be soft-trimmed or hard-cleared.
- In `adaptive` mode, when the estimated context ratio crosses `softTrimRatio`, `midTrim` may condense older user/assistant messages in the *in-memory request context* (never the JSONL history). Set `midTrim.turnsThreshold: 0` to disable.
- The last `keepLastAssistants` assistant messages are protected; tool results after that cutoff are not pruned.
- If there aren’t enough assistant messages to establish the cutoff, pruning is skipped.
- Tool results containing **image blocks** are skipped (never trimmed/cleared).

## Context window estimation
Pruning uses an estimated context window (chars ≈ tokens × 4). The window size is resolved in this order:
1) Model definition `contextWindow` (from the model registry).
2) `models.providers.*.models[].contextWindow` override.
3) `agents.defaults.contextTokens`.
4) Default `200000` tokens.

## Modes
### adaptive
- If estimated context ratio ≥ `softTrimRatio`: soft-trim oversized tool results, and may mid-trim older user/assistant messages (`midTrim`) before hard-clear.
- If still ≥ `hardClearRatio` **and** prunable tool text ≥ `minPrunableToolChars`: hard-clear oldest eligible tool results.

### aggressive
- Always hard-clears eligible tool results before the cutoff.
- Ignores `hardClear.enabled` (always clears when eligible).

## Soft vs hard pruning
- **Soft-trim**: only for oversized tool results.
  - Keeps head + tail, inserts `...`, and appends a note with the original size.
  - Skips results with image blocks.
- **Hard-clear**: replaces the entire tool result with `hardClear.placeholder`.

## Tool selection
- `tools.allow` / `tools.deny` support `*` wildcards.
- Deny wins.
- Matching is case-insensitive.
- Empty allow list => all tools allowed.

## Interaction with other limits
- Built-in tools already truncate their own output; session pruning is an extra layer that prevents long-running chats from accumulating too much tool output in the model context.
- Compaction is separate: compaction summarizes and persists, pruning is transient per request. See [/concepts/compaction](/concepts/compaction).

## Defaults (when enabled)
- `keepLastAssistants`: `3`
- `softTrimRatio`: `0.3`
- `hardClearRatio`: `0.5`
- `minPrunableToolChars`: `50000`
- `softTrim`: `{ maxChars: 4000, headChars: 1500, tailChars: 1500 }`
- `hardClear`: `{ enabled: true, placeholder: "[Old tool result content cleared]" }`
- `midTrim`: `{ turnsThreshold: 8, maxUserChars: 600, maxAssistantChars: 800 }` (adaptive only; set `turnsThreshold: 0` to disable)

## Examples
Default (adaptive):
```json5
{
  agents: { defaults: { contextPruning: { mode: "adaptive" } } }
}
```

To disable:
```json5
{
  agents: { defaults: { contextPruning: { mode: "off" } } }
}
```

Aggressive:
```json5
{
  agents: { defaults: { contextPruning: { mode: "aggressive" } } }
}
```

Restrict pruning to specific tools:
```json5
{
  agents: {
    defaults: {
      contextPruning: {
        mode: "adaptive",
        tools: { allow: ["bash", "read"], deny: ["*image*"] }
      }
    }
  }
}
```

See config reference: [Gateway Configuration](/gateway/configuration)
