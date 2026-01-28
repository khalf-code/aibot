# @moltbot/agentmail

Email channel plugin for Moltbot via [AgentMail](https://agentmail.to).

## Installation

From npm:

```bash
moltbot plugins install @moltbot/agentmail
```

From local checkout:

```bash
moltbot plugins install ./extensions/agentmail
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

## Features

- WebSocket-based real-time email handling (no public URL required)
- Full thread context for conversation history
- Sender allowFrom filtering
- Attachment metadata with on-demand download URLs
- Interactive onboarding with inbox creation

## Documentation

See [AgentMail channel docs](https://docs.clawd.bot/channels/agentmail) for full details.
