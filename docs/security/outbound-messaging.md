---
title: Outbound Messaging Security Model
layout: default
nav_order: 1
parent: Security
---

# Outbound Messaging Security Model

This document explains Clawdbot's outbound messaging security model, including allowlist enforcement, target resolution, sub-agent messaging best practices, and automation recipient configuration.

## Overview

Clawdbot implements multiple layers of security for outbound messaging to prevent unauthorized message sends:

1. **Allowlist Enforcement** - Validates targets against configured allowlists
2. **Automation Recipients** - Separate allowlist for automated/system sends
3. **Sub-Agent Restrictions** - Blocks direct message sends from sub-agents
4. **Target Resolution** - Controlled resolution of message targets
5. **Request Logging** - Full audit trail of all send operations
6. **First-Time Recipient Warnings** - Alerts for sends to new recipients
7. **Dry-Run Mode** - Development/testing mode to prevent accidental sends

## Allowlist Enforcement

### Configuration

Allowlists are configured per channel. For WhatsApp:

```json
{
  "channels": {
    "whatsapp": {
      "allowFrom": ["+16505551234", "+16505555678"],
      "accounts": {
        "default": {
          "allowFrom": ["+16505551234"]
        }
      }
    }
  }
}
```

### Enforcement Rules

1. **Explicit Mode Sends** (CLI with `--target`, direct API calls):
   - Target MUST be in allowlist OR use `--allow-unlisted` flag
   - Groups are always allowed (no allowlist check)
   - Empty allowlist = all targets allowed

2. **Implicit Mode Sends** (session-derived routing):
   - If target not in allowlist, falls back to first allowlist entry
   - Provides safe default behavior

3. **Heartbeat/Automation Mode Sends**:
   - Validates against `automation.recipients` if configured
   - Falls back to general allowlist if automation.recipients is empty

### Security Bypass

The `--allow-unlisted` CLI flag allows sending to targets not in the allowlist:

```bash
clawdbot message send --target +16505559999 --message "Hello" --allow-unlisted
```

This is logged and should only be used for emergencies.

## Automation Recipients

### Purpose

The `automation.recipients` list provides a stricter allowlist specifically for automated sends (heartbeats, cron jobs, system events, daemon notifications).

### Configuration

```json
{
  "channels": {
    "whatsapp": {
      "automation": {
        "recipients": ["+16505551234"]
      },
      "accounts": {
        "default": {
          "automation": {
            "recipients": ["+16505551234"]
          }
        }
      }
    }
  }
}
```

### Behavior

- If `automation.recipients` is configured (non-empty), only those numbers can receive automated sends
- If empty/not configured, falls back to general `allowFrom` behavior
- This separation prevents automation from accidentally messaging contacts that are allowed for interactive use but shouldn't receive automated notifications

## Sub-Agent Messaging Restrictions

### Default Behavior (FIX-1.5)

By default, sub-agents CANNOT directly call `clawdbot message send` or the message RPC API. This prevents:

- Prompt injection attacks causing sub-agents to spam messages
- Sub-agents bypassing session routing controls
- Accidental sends from poorly-written sub-agent prompts

### Blocked Actions

- `send` - Direct message sends
- `poll` - Poll creation
- `broadcast` - Broadcast sends

### Allowed Actions

Sub-agents can still use:
- `sessions_send` tool - Routes through parent session context
- Blessed callback mechanisms that go through proper routing

### Security Logging

Blocked attempts are logged:
```
[security] Subagent agent:main:subagent:abc123 attempted direct message send - blocked
```

### Override (Not Recommended)

To allow direct sends (use with caution):

```json
{
  "agents": {
    "defaults": {
      "subagents": {
        "allowDirectMessageSend": true
      }
    }
  }
}
```

## Target Resolution Behavior

### Resolution Modes

1. **Explicit** - Target specified directly by user/caller
2. **Session** - Target derived from current session context
3. **Fallback** - Target resolved from allowlist or directory
4. **Allowlist** - Target normalized from allowlist entry
5. **Directory** - Target resolved from contacts directory

### Resolution Order

For different send paths:

| Path | Resolution Priority |
|------|---------------------|
| CLI with `--target` | Explicit → Validate → Send |
| Tool call | Explicit → Session → Fallback |
| Heartbeat | Explicit → Automation Recipients → Allowlist[0] |
| System Event | Requires explicit target (no fallback) |

### Logging

All target resolution is logged with source and method:
```
[send] source=cli channel=whatsapp target=+165***1234 resolvedFrom=explicit
```

## Request Logging (FIX-2.2)

Every send operation is logged with full context:

### Log Format

```
[send] source=cli|rpc|session|sub-agent|tool sessionKey=xxx channel=whatsapp target=+xxx resolvedFrom=explicit|session|fallback
```

### Logged Fields

| Field | Description |
|-------|-------------|
| source | Origin of the send request |
| sessionKey | Session key if applicable |
| channel | Target channel (whatsapp, telegram, etc.) |
| target | Target recipient (masked for privacy) |
| resolvedTarget | Final resolved target if different |
| resolvedFrom | How the target was resolved |
| accountId | Channel account used |
| dryRun | Whether this was a dry-run |
| firstTime | Whether this is a first-time recipient |

## First-Time Recipient Warnings (FIX-3.1)

### Purpose

Provides visibility when automation sends to a new recipient for the first time, even if they're in the allowlist.

### Behavior

When sending to a recipient not previously contacted:

1. Warning is logged: `[whatsapp] First-time recipient: +165***1234 (in allowlist)`
2. The send proceeds normally (not blocked)
3. Recipient is recorded for future reference

### Storage

Known recipients are tracked in:
```
~/.clawdbot/known-recipients.json
```

### Log Output

```
[outbound/known-recipients] New recipient recorded: whatsapp:+165***1234
[outbound/known-recipients] [whatsapp] First-time recipient: +165***1234 (in allowlist)
```

## Dry-Run Mode (FIX-3.3)

### Purpose

Prevents actual message sends during development and testing.

### Enabling

**Environment Variable:**
```bash
export CLAWDBOT_DRY_RUN=true
clawdbot gateway start
```

**CLI Flag:**
```bash
clawdbot message send --target +1234 --message "test" --dry-run
```

### Behavior

When dry-run is enabled:
- All outbound sends are logged but not executed
- Log format: `[dry-run] would send to +xxx: message preview...`
- API returns success with `dryRun: true` in response
- No actual messages are delivered

### Log Output

```
[outbound/dry-run] [dry-run] would send to +165***1234 channel=whatsapp source=cli message="Hello world"
```

## Best Practices

### For Operators

1. **Configure tight allowlists** - Only include numbers that should receive messages
2. **Use automation.recipients** - Separate interactive contacts from automation targets
3. **Enable dry-run for development** - Set `CLAWDBOT_DRY_RUN=true` when testing
4. **Monitor first-time recipient warnings** - Review logs for unexpected new contacts
5. **Review request logs** - Audit `[send]` log entries periodically

### For Sub-Agent Development

1. **Use sessions_send** - Route messages through parent session context
2. **Don't call clawdbot message send directly** - It will be blocked
3. **Specify explicit targets** - Don't rely on implicit routing
4. **Handle blocked sends gracefully** - Catch and log errors

### For Automation

1. **Always specify --target and --channel** - Never rely on defaults
2. **Use automation.recipients** - Configure explicit automation targets
3. **Test with dry-run** - Verify behavior before enabling real sends
4. **Log all send attempts** - Maintain audit trail

## Security Incident Response

If an unauthorized send occurs:

1. **Check request logs** - Find `[send]` entries around the incident time
2. **Review source field** - Identify what triggered the send
3. **Check session key** - Trace to the originating session
4. **Audit target resolution** - Verify how the target was resolved
5. **Review known-recipients.json** - Check if recipient was previously known

## Related Configuration

```json
{
  "channels": {
    "whatsapp": {
      "allowFrom": ["..."],
      "automation": {
        "recipients": ["..."]
      }
    }
  },
  "agents": {
    "defaults": {
      "subagents": {
        "allowDirectMessageSend": false
      },
      "heartbeat": {
        "requireExplicitTarget": true
      }
    }
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAWDBOT_DRY_RUN` | Enable dry-run mode (true/1/yes) |
| `CLAWDBOT_STATE_DIR` | Location for known-recipients.json |

---

*Last updated: 2026-01-25*
