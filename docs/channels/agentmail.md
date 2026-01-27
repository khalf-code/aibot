---
summary: "AgentMail email channel support, capabilities, and configuration"
read_when:
  - Working on AgentMail/email channel features
---

# AgentMail

AgentMail is an email API service designed for AI agents. Clawdbot connects to AgentMail via
webhooks to receive incoming emails and uses the AgentMail API to send replies. This enables
email as a conversation channel for your AI assistant.

Status: supported via plugin. Direct messages (email threads), media (attachments as links),
and threading are supported.

## Plugin required

AgentMail ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):

```bash
clawdbot plugins install @clawdbot/agentmail
```

Local checkout (when running from a git repo):

```bash
clawdbot plugins install ./extensions/agentmail
```

Details: [Plugins](/plugin)

## Setup

1. Install the AgentMail plugin:

   - From npm: `clawdbot plugins install @clawdbot/agentmail`
   - From a local checkout: `clawdbot plugins install ./extensions/agentmail`

2. Create an AgentMail account at [agentmail.to](https://agentmail.to)

3. Get your API key from the AgentMail dashboard

4. Create an inbox (or use an existing one) and note the inbox ID

5. Webhook setup:

   - **Automatic**: During onboarding, provide your gateway's public URL and the webhook will be auto-registered
   - **Manual**: Register in the AgentMail dashboard with URL `https://your-gateway/webhooks/agentmail` and event type `message.received`

6. Configure credentials:

   - Env: `AGENTMAIL_TOKEN`, `AGENTMAIL_EMAIL_ADDRESS`
   - Or config: `channels.agentmail.token`, `channels.agentmail.emailAddress`
   - If both are set, config takes precedence.

7. Restart the gateway (or finish onboarding)

8. Send an email to your AgentMail inbox to test the integration

Minimal config:

```json5
{
  channels: {
    agentmail: {
      enabled: true,
      token: "am_***",
      emailAddress: "you@agentmail.to",
    },
  },
}
```

## Configuration

| Key            | Type     | Description                                              |
| -------------- | -------- | -------------------------------------------------------- |
| `name`         | string   | Account name for identifying this configuration          |
| `enabled`      | boolean  | Enable/disable the channel (default: true)               |
| `token`        | string   | AgentMail API token (required)                           |
| `emailAddress` | string   | AgentMail inbox email address to monitor (required)      |
| `webhookUrl`   | string   | Gateway public base URL (e.g., `https://gw.ngrok.io`)    |
| `webhookPath`  | string   | Custom webhook path (default: `/webhooks/agentmail`)     |
| `allowlist`    | string[] | Allowed sender emails/domains                            |
| `blocklist`    | string[] | Blocked sender emails/domains                            |

## Sender Filtering

AgentMail supports allowlist and blocklist filtering for incoming emails. Both lists accept
email addresses and domains.

### Allowlist/Blocklist Logic

1. If sender is on the blocklist, the message is labeled `blocked` and ignored
2. If sender is on the allowlist, the message is labeled `allowed` and triggers Clawdbot
3. If allowlist is empty and sender is not blocked, the message is `allowed` (open mode)
4. If allowlist is non-empty and sender is not on it, the message is ignored

### Example Configuration

```json5
{
  channels: {
    agentmail: {
      enabled: true,
      token: "am_***",
      emailAddress: "clawd@agentmail.to",
      // Allow specific emails and domains
      allowlist: ["alice@example.com", "trusted-domain.org"],
      // Block specific emails and domains
      blocklist: ["spam@bad.com", "bad-domain.net"],
    },
  },
}
```

### Domain Matching

Domain entries match any email from that domain:

- `example.org` in allowlist allows `alice@example.org`, `bob@example.org`, etc.
- `bad.com` in blocklist blocks `spam@bad.com`, `anything@bad.com`, etc.

## Thread Context

When an email arrives, Clawdbot fetches the full email thread to provide conversation context
to the AI. This enables the assistant to understand prior messages in the thread and provide
contextually relevant replies.

Thread context is automatically included when:

- The incoming email is part of an existing thread
- The thread has more than one message

The plugin uses AgentMail's `extracted_text` field which contains only the new content from
each message (excluding quoted reply text). This provides cleaner context without duplicated
quoted sections.

## Environment Variables

| Variable                   | Description                   |
| -------------------------- | ----------------------------- |
| `AGENTMAIL_TOKEN`          | AgentMail API token           |
| `AGENTMAIL_EMAIL_ADDRESS`  | AgentMail inbox email address |
| `AGENTMAIL_WEBHOOK_PATH`   | Custom webhook path           |

## Webhook Security

AgentMail webhooks should be configured with HTTPS endpoints. Ensure your gateway is
accessible from the internet and properly secured.

For local development, you can use tools like ngrok to tunnel webhooks to your local machine:

```bash
ngrok http 18789
```

Then register the ngrok URL as your webhook endpoint in the AgentMail dashboard.

## Capabilities

| Feature             | Supported            |
| ------------------- | -------------------- |
| Direct messages     | Yes                  |
| Groups/rooms        | No                   |
| Threads             | Yes                  |
| Media (attachments) | Partial (links only) |
| Reactions           | No                   |
| Polls               | No                   |

## Troubleshooting

### Messages not being received

1. Verify the webhook is registered in AgentMail dashboard
2. Check that the webhook URL is correct and accessible
3. Ensure `token` and `emailAddress` are configured correctly
4. Check the gateway logs for webhook errors

### Replies not being sent

1. Verify the API token has send permissions
2. Check the gateway logs for outbound errors
3. Ensure the email address is correct

### Sender not allowed

1. Check the `allowlist` and `blocklist` configuration
2. Verify the sender email matches the expected format
3. Check if the sender's domain is blocked
