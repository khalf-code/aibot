---
summary: "Twitch chat bot support status, capabilities, and configuration"
read_when:
  - Setting up Twitch chat integration for Clawdbot
  - Configuring Twitch bot permissions and access control
---
# Twitch (plugin)

Twitch chat support via IRC connection. Clawdbot connects as a Twitch user (bot account) to receive and send messages in channels.

Status: ready for Twitch chat via IRC connection with @twurple.

## Plugin required

Twitch ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):

```bash
clawdbot plugins install @clawdbot/twitch
```

Local checkout (when running from a git repo):

```bash
clawdbot plugins install ./extensions/twitch
```

Details: [Plugins](/plugin)

## Setup

1) Install the Twitch plugin and create a dedicated Twitch account for the bot.
2) Generate your credentials (recommended: use [Twitch Token Generator](https://twitchtokengenerator.com/)):
   - Select **Bot Token**
   - Verify scopes `chat:read` and `chat:write` are selected
   - Copy the **Client ID** and **Access Token**
3) Configure credentials:
   - Env: `CLAWDBOT_TWITCH_ACCESS_TOKEN=...` (default account only)
   - Or config: `channels.twitch.accounts.default.accessToken`
   - If both are set, config takes precedence (env fallback is default-account only).
4) Start the gateway.
5) The bot joins your channel and responds to messages.

**⚠️ Important:** Strongly recommended to add `requireMention` and access control (`allowFrom` or `allowedRoles`) to prevent the bot from replying to all chat messages.

Minimal config:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "clawdbot",              // Bot's Twitch account
      accessToken: "oauth:abc123...",    // OAuth Access Token (or use CLAWDBOT_TWITCH_ACCESS_TOKEN env var)
      clientId: "your_client_id",        // Client ID from Token Generator
      channel: "vevisk",                 // Which Twitch channel's chat to join
      requireMention: true,              // (recommended) Only reply when mentioned
      allowFrom: ["123456789"]           // (recommended) Your Twitch user ID only (Convert your twitch username to ID at https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/)
    }
  }
}
```

**Recommended access control options:**
- `requireMention: true` - Only respond when the bot is mentioned with `@botname`
- `allowFrom: ["your_user_id"]` - Restrict to your Twitch user ID only
- `allowedRoles: ["moderator", "vip", "subscriber"]` - Restrict to specific roles

**Note:** [Twitch Token Generator](https://twitchtokengenerator.com/) provides the Client ID and Access Token (select **Bot Token** and verify `chat:read` + `chat:write` scopes) - no manual app registration needed.

**Note:** `username` is the bot's account, `channel` is which chat to join.

## How it works

1. Create a bot account (or use an existing Twitch account).
2. Generate credentials using [Twitch Token Generator](https://twitchtokengenerator.com/) (provides Client ID, Access Token, and optionally Refresh Token).
3. Configure Clawdbot with the credentials.
4. Run the gateway; it auto-starts the Twitch channel when a token is available (config first, env fallback) and `channels.twitch.enabled` is not `false`.
5. The bot joins the specified `channel` to send/receive messages.
6. Each account maps to an isolated session key `agent:<agentId>:twitch:<accountName>`.

**Key distinction:** `username` is who the bot authenticates as (the bot's account), `channel` is which chat room it joins.

## Token refresh (optional)

Tokens from [Twitch Token Generator](https://twitchtokengenerator.com/) cannot be automatically refreshed - you'll need to generate a new token when it expires (typically after several hours).

For automatic token refresh, create your own Twitch application at [Twitch Developer Console](https://dev.twitch.tv/console) and add `clientSecret` and `refreshToken` to your config. The bot automatically refreshes tokens before they expire and logs refresh events.

## Routing model

- Replies always go back to Twitch.
- Each account maps to `agent:<agentId>:twitch:<accountName>`.

## Multi-account support

Use `channels.twitch.accounts` with per-account tokens. See [`gateway/configuration`](/gateway/configuration) for the shared pattern.

Example (one bot account in two different channels):

```json5
{
  channels: {
    twitch: {
      accounts: {
        ninjaChannel: {
          username: "clawdbot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk"
        },
        shroudChannel: {
          username: "clawdbot",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel"
        }
      }
    }
  }
}
```

## Access control

### Role-based restrictions

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          allowedRoles: ["moderator", "vip"]
        }
      }
    }
  }
}
```

**Available roles:** `"moderator"`, `"owner"`, `"vip"`, `"subscriber"`, `"all"`.

### Allowlist by User ID

Only allow specific Twitch user IDs (most secure):

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          allowFrom: ["123456789", "987654321"]
        }
      }
    }
  }
}
```

**Why user IDs instead of usernames?** Twitch usernames can change, which could allow someone to hijack another user's access. User IDs are permanent.

Find your Twitch user ID at: https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/

### Combined allowlist + roles

Users in `allowFrom` bypass role checks. Example:
- User `123456789` can always message (bypasses role check)
- All moderators can message
- Everyone else is blocked

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          allowFrom: ["123456789"],
          allowedRoles: ["moderator"]
        }
      }
    }
  }
}
```

### Require @mention

Only respond when the bot is mentioned:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          requireMention: true
        }
      }
    }
  }
}
```

## Capabilities & limits

**Supported:**
- ✅ Channel messages (group chat)
- ✅ Whispers/DMs (received but replies not supported - Twitch doesn't allow bots to send whispers)
- ✅ Markdown stripping (automatically applied)
- ✅ Message chunking (500 char limit)
- ✅ Access control (user ID allowlist, role-based)
- ✅ @mention requirement
- ✅ Automatic token refresh (with RefreshingAuthProvider)
- ✅ Multi-account support

**Not supported:**
- ❌ Native reactions
- ❌ Threaded replies
- ❌ Message editing
- ❌ Message deletion
- ❌ Rich embeds/media uploads (sends media URLs as text)

## Troubleshooting

First, run diagnostic commands:

```bash
clawdbot doctor
clawdbot channels status --probe
```

### Bot doesn't respond to messages

**Check access control:** Temporarily set `allowedRoles: ["all"]` to test.

**Check the bot is in the channel:** The bot must join the channel specified in `channel`.

### Token issues

**"Failed to connect" or authentication errors:**
- Verify `accessToken` is the OAuth access token value (typically starts with `oauth:` prefix)
- Check token has `chat:read` and `chat:write` scopes
- If using RefreshingAuthProvider, verify `clientSecret` and `refreshToken` are set

### Token refresh not working

**Check logs for refresh events:**
```
Using env token source for mybot
Access token refreshed for user 123456 (expires in 14400s)
```

If you see "token refresh disabled (no refresh token)":
- Ensure `clientSecret` is provided
- Ensure `refreshToken` is provided

## Config

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "clawdbot",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
      clientSecret: "secret123...",
      refreshToken: "refresh456...",
      requireMention: true,
      allowFrom: ["123456789"],
      allowedRoles: ["moderator", "vip"],
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          enabled: true,
          clientSecret: "secret123...",
          refreshToken: "refresh456...",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000,
          allowFrom: ["123456789", "987654321"],
          allowedRoles: ["moderator"],
          requireMention: true
        }
      }
    }
  },
  plugins: {
    entries: {
      twitch: {
        stripMarkdown: true
      }
    }
  }
}
```

**Account config:**
- `username` - Bot username
- `accessToken` - OAuth access token with `chat:read` and `chat:write`
- `clientId` - Twitch Client ID (from Token Generator or your app)
- `channel` - Channel to join
- `enabled` - Enable this account (default: `true`)
- `clientSecret` - Optional: For automatic token refresh (from YOUR Twitch app)
- `refreshToken` - Optional: For automatic token refresh (from YOUR Twitch app)
- `expiresIn` - Token expiry in seconds
- `obtainmentTimestamp` - Token obtained timestamp
- `allowFrom` - User ID allowlist
- `allowedRoles` - Role-based access control (`"moderator" | "owner" | "vip" | "subscriber" | "all"`)
- `requireMention` - Require @mention (default: `false`)

**Plugin config:**
- `stripMarkdown` - Strip markdown from outbound (default: `true`)

**Provider options:**
- `channels.twitch.enabled` - Enable/disable channel startup
- `channels.twitch.username` - Bot username (simplified single-account config)
- `channels.twitch.accessToken` - OAuth access token (simplified single-account config)
- `channels.twitch.clientId` - Twitch Client ID (simplified single-account config)
- `channels.twitch.channel` - Channel to join (simplified single-account config)
- `channels.twitch.accounts.<accountName>` - Multi-account config (all account fields above)

## Tool actions

The agent can call `twitch` with action:
- `send` - Send a message to a channel

Example:

```json5
{
  "action": "twitch",
  "params": {
    "message": "Hello Twitch!",
    "to": "#mychannel"
  }
}
```

## Safety & ops

- **Treat tokens like passwords** - Never commit tokens to git
- **Use RefreshingAuthProvider** for long-running bots
- **Use user ID allowlists** instead of usernames for access control
- **Monitor logs** for token refresh events and connection status
- **Scope tokens minimally** - Only request `chat:read` and `chat:write`
- **If stuck**: Restart the gateway after confirming no other process owns the session

## Message limits

- **500 characters** per message (Twitch limit)
- Messages are automatically chunked at word boundaries
- Markdown is stripped before chunking to avoid breaking patterns
- No rate limiting (uses Twitch's built-in rate limits)
