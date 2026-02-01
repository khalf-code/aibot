# Model routing + cost receipts

This runbook documents OpenClaw’s rule-based model router and per-run cost/usage receipts.

## Goals
- Pick provider/model per *context* (channel, cron lane, session key prefix, agent id)
- Support explicit per-run fallbacks
- Emit receipts + rollups so you can see where spend is coming from

## Configuration

### 1) Enable per-run usage logging (for rollups)

```json5
{
  models: {
    routing: {
      usageLog: { enabled: true }
    }
  }
}
```

This writes an append-only log to:
- `~/.openclaw/usage/runs.jsonl`

### 2) Add routing rules
Rules are evaluated in order; first match wins.

```json5
{
  models: {
    routing: {
      rules: [
        {
          name: "Discord chat: cheap by default",
          match: { channel: "discord", isCron: false },
          model: { primary: "openai-codex/gpt-5.2" }
        },
        {
          name: "Cron jobs: cheaper model",
          match: { isCron: true },
          model: {
            primary: "kimi/kimi-code",
            fallbacks: ["zai/glm-4.7"]
          }
        },
        {
          name: "Gmail hook: safer/stronger",
          match: { sessionKeyPrefix: "hook:gmail:" },
          model: { primary: "anthropic/claude-sonnet-4-5" }
        }
      ],
      receipts: {
        // Optional global default for usage footer behavior in chat
        defaultMode: "off" // off | tokens | cost | full
      }
    }
  }
}
```

Notes:
- `model.primary` and `model.fallbacks[]` accept either `provider/model` or a configured alias.
- Cron routing uses the cron job’s resolved delivery channel + lane.

## Receipts

### Per-message receipts (chat)
- Session-level receipts are controlled via `/usage` (existing behavior).
- Routing rules can override the session setting with `receipt: "tokens"|"cost"|"full"`.

### Rollups
Use:
- `/usage rollup` (defaults to 1 day)
- `/usage rollup 7`
- `/usage rollup 7 channel:discord`

Rollups are computed from `~/.openclaw/usage/runs.jsonl`.

## Troubleshooting
- If costs show as `n/a`, you likely have OAuth-based auth for that provider/model (no API-key cost accounting) or missing per-model cost entries.
- If rollup says “no data”, ensure `models.routing.usageLog.enabled=true` and run at least one chat/cron turn.
