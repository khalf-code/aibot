# Compliance Hook Plugin PR

## Summary

This PR adds a configurable compliance logging hook that automatically tracks agent activity without requiring agents to manually log their work.

## Motivation

- **Zero agent involvement** — Agents can't forget to log; it happens at the gateway level
- **Complete audit trail** — Every agent action has gateway-level evidence
- **Configurable** — Choose which events to log and where to send them
- **Privacy controls** — Optional content redaction for human messages

Previously, compliance logging was hardcoded to a specific Mission Control CLI. This PR abstracts it into a proper plugin with multiple destination types.

## Changes

### New Files

```
src/hooks/bundled/compliance/
├── HOOK.md           # Documentation
├── index.ts          # Module exports
├── types.ts          # TypeScript types for config & events
├── emitter.ts        # Emitter factory
├── handler.ts        # Hook handler + exported convenience functions
└── destinations/
    ├── webhook.ts    # HTTP POST destination
    ├── file.ts       # JSONL file destination
    ├── cli.ts        # External CLI destination
    └── telemetry.ts  # Telemetry plugin integration
```

### Modified Files

- `src/plugins/hooks.ts` — Removed hardcoded MC logging, added notes pointing to compliance hook
- `src/gateway/server-cron.ts` — Use `logCronStart`/`logCronComplete` from compliance handler
- `src/agents/tools/sessions-spawn-tool.ts` — Use `logSpawnStart` from compliance handler
- `src/agents/tools/sessions-send-tool.ts` — Use `logDmSent` from compliance handler
- `src/agents/subagent-announce.ts` — Use `logSpawnComplete` from compliance handler

### Removed Files

- `src/agents/tools/mc-logging.ts` — Replaced by compliance hook

## Configuration

Enable in `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "compliance": {
          "enabled": true,
          "events": [
            "agent_start",
            "agent_end",
            "cron_start",
            "cron_complete",
            "spawn_start",
            "spawn_complete",
            "dm_sent"
          ],
          "destination": {
            "type": "webhook",
            "url": "https://your-backend.com/api/compliance",
            "headers": {
              "Authorization": "Bearer ${COMPLIANCE_TOKEN}"
            }
          },
          "redactContent": true
        }
      }
    }
  }
}
```

## Destination Types

| Type        | Description              | Use Case                            |
| ----------- | ------------------------ | ----------------------------------- |
| `webhook`   | POST to HTTP endpoint    | Cloud backends, SaaS integrations   |
| `file`      | Append to JSONL file     | Local logging, log rotation         |
| `cli`       | Execute external command | Legacy systems, custom integrations |
| `telemetry` | Use telemetry plugin     | Existing telemetry sync setup       |

## Events

| Event              | When                     | Example                                  |
| ------------------ | ------------------------ | ---------------------------------------- |
| `agent_start`      | Agent session begins     | `Worker - STARTING [telegram]`           |
| `agent_end`        | Agent session completes  | `Worker - COMPLETE [telegram]`           |
| `cron_start`       | Cron job begins          | `Worker - STARTING: email-check`         |
| `cron_complete`    | Cron job completes       | `Worker - COMPLETE: email-check`         |
| `spawn_start`      | Spawn task dispatched    | `Main - SPAWN: research task`            |
| `spawn_complete`   | Spawn task completed     | `Worker - SPAWN_COMPLETE: research task` |
| `dm_sent`          | Agent-to-agent DM        | `Main -> QA: please review`              |
| `message_received` | Human message (optional) | `[telegram] Craig: [redacted]`           |

## Privacy

By default:

- Human message content is **redacted** (`redactContent: true`)
- `message_received` events are **disabled** by default
- Only compliance-relevant metadata is logged

## Testing

```bash
# Build
pnpm build

# Enable compliance hook
openclaw hooks enable compliance

# Configure destination in openclaw.json
# Then trigger some agent activity and check logs
```

## Breaking Changes

None. The compliance hook is opt-in and disabled by default.

## Migration from Custom MC Logging

If you were using the previous hardcoded MC logging:

1. Enable the compliance hook
2. Configure CLI destination pointing to your MC script:
   ```json
   {
     "destination": {
       "type": "cli",
       "command": "~/clawd/mission-control/mc"
     }
   }
   ```
3. The log format is identical to the previous implementation
