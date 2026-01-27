# @clawdbot/agentmail

Email channel plugin for Clawdbot via [AgentMail](https://agentmail.to).

## Installation

From npm:

```bash
clawdbot plugins install @clawdbot/agentmail
```

From local checkout:

```bash
clawdbot plugins install ./extensions/agentmail
```

## Configuration

Set credentials via environment variables:

```bash
export AGENTMAIL_TOKEN="am_..."
export AGENTMAIL_EMAIL_ADDRESS="you@agentmail.to"
```

Or via config:

```json5
{
  channels: {
    agentmail: {
      enabled: true,
      token: "am_...",
      emailAddress: "you@agentmail.to",
    },
  },
}
```

## Webhook Setup

Register a webhook in the AgentMail dashboard:

- **URL:** `https://your-gateway-host:port/webhooks/agentmail`
- **Event:** `message.received`

## Features

- Webhook-based inbound email handling
- Full thread context for conversation history
- Sender allowlist/blocklist filtering
- Attachment metadata with on-demand download URLs
- Interactive onboarding with inbox creation

## Documentation

See [AgentMail channel docs](https://docs.clawd.bot/channels/agentmail) for full details.
