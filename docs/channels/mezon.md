---
summary: "Mezon bot support status, capabilities, and configuration"
read_when:
  - Working on Mezon features or Bot SDK integration
---
# Mezon (Bot SDK)

Status: experimental. Direct messages and group channels via Mezon Bot SDK.

## Plugin required
Mezon ships as a plugin and is not bundled with the core install.
- Install via CLI: `openclaw plugins install @openclaw/mezon`
- Or select **Mezon** during onboarding and confirm the install prompt
- Details: [Plugins](/plugin)

## Quick setup (beginner)
1) Install the Mezon plugin:
   - From a source checkout: `openclaw plugins install ./extensions/mezon`
   - From npm (if published): `openclaw plugins install @openclaw/mezon`
   - Or pick **Mezon** in onboarding and confirm the install prompt
2) Set credentials:
   - Env: `MEZON_BOT_ID=...` and `MEZON_BOT_TOKEN=...`
   - Or config: `channels.mezon.botId` and `channels.mezon.botToken`
3) Restart the gateway (or finish onboarding).
4) DM access is pairing by default; approve the pairing code on first contact.

Minimal config:
```json5
{
  channels: {
    mezon: {
      enabled: true,
      botId: "1840692863290052608",
      botToken: "your-bot-token",
      dmPolicy: "pairing"
    }
  }
}
```

## What it is
Mezon is a modern team communication platform. The Bot SDK lets the Gateway run a bot for direct messages and group channels.
- A Mezon bot channel owned by the Gateway.
- WebSocket connection via Mezon SDK.
- DMs and group channels supported.
- Group or Clan messages must start with `#` to be processed (e.g. `#Hello bot`).

## Setup (fast path)

### 1) Create a bot (Mezon platform)
1) Go to the Mezon developer platform and create a new bot.
2) Copy the Bot ID and Bot Token.
3) Install the bot into your clan.

### 2) Configure credentials (env or config)
Example:

```json5
{
  channels: {
    mezon: {
      enabled: true,
      botId: "1840692863290052608",
      botToken: "your-bot-token",
      dmPolicy: "pairing"
    }
  }
}
```

Env option: `MEZON_BOT_ID` and `MEZON_BOT_TOKEN` (works for the default account only).

Token file: `channels.mezon.tokenFile` with format `botId:token` or just `token` (requires botId elsewhere).

Multi-account support: use `channels.mezon.accounts` with per-account credentials and optional `name`.

3) Restart the gateway. Mezon connects via WebSocket when credentials are resolved.
4) DM access defaults to pairing. Approve the code when the bot is first contacted.

## How it works (behavior)
- Inbound messages are normalized into the shared channel envelope with media placeholders.
- Replies always route back to the same Mezon chat.
- WebSocket connection via Mezon SDK; reconnection handled internally.
- Group messages require a `#` prefix (e.g. `#hello`) to be processed; DMs do not.
- Raw LLM/API errors are replaced with user-friendly messages before sending.

## Limits
- Outbound text is chunked to 4000 characters.
- Media downloads/uploads are capped by `channels.mezon.mediaMaxMb` (default 10).
- Streaming is blocked by default.

## Access control (DMs)

### DM access
- Default: `channels.mezon.dmPolicy = "pairing"`. Unknown senders receive a pairing code; messages are ignored until approved.
- Approve via:
  - `openclaw pairing list mezon`
  - `openclaw pairing approve mezon <CODE>`
- Pairing is the default token exchange. Details: [Pairing](/start/pairing)
- `channels.mezon.allowFrom` accepts numeric user IDs (mezon: or mz: prefixes are normalized).

### Group messages
- Group messages must start with `#` to be processed.
- Example: `#Hello bot` → processed; `Hello bot` → ignored.
- DMs do not require the prefix.

## Custom gateway
- `channels.mezon.host`: gateway host (default: gw.mezon.ai)
- `channels.mezon.port`: port (default: 443)
- `channels.mezon.useSSL`: use TLS (default: true)

## Supported message types
- **Text messages**: Full support with 4000 character chunking.
- **Attachments**: Inbound attachments are downloaded and processed; outbound appends media URLs to text.
- **Reactions**: Supported.
- **Threads**: Supported.

## Capabilities
| Feature | Status |
|---------|--------|
| Direct messages | Supported |
| Groups | Supported |
| Media (attachments) | Supported |
| Reactions | Supported |
| Threads | Supported |
| Polls | Not supported |
| Native commands | Not supported |
| Streaming | Blocked |

## Delivery targets (CLI/cron)
- Use a channel ID or user ID as the target.
- Example: `openclaw message send --channel mezon --target 1234567890 --message "hi"`

## Troubleshooting

**Bot does not respond:**
- Check credentials: `openclaw channels status --probe`
- Verify the sender is approved (pairing or allowFrom)
- For groups, ensure the message starts with `#`
- Check gateway logs: `openclaw logs --follow`

**Better-sqlite3 bindings error:**
- Ensure build scripts are allowed (e.g. `.npmrc` with `allow-build-scripts=better-sqlite3`)
- Rebuild: `pnpm rebuild better-sqlite3`

**ENOENT mezon-cache:**
- The plugin creates `./mezon-cache` automatically; ensure the gateway process has write permission in its working directory.

## Configuration reference (Mezon)
Full configuration: [Configuration](/gateway/configuration)

Provider options:
- `channels.mezon.enabled`: enable/disable channel startup.
- `channels.mezon.botId`: bot ID from Mezon platform.
- `channels.mezon.botToken`: bot token from Mezon platform.
- `channels.mezon.tokenFile`: read credentials from file (format: `botId:token` or `token` with botId elsewhere).
- `channels.mezon.dmPolicy`: `pairing | allowlist | open | disabled` (default: pairing).
- `channels.mezon.allowFrom`: DM allowlist (user IDs). `open` requires `"*"`.
- `channels.mezon.mediaMaxMb`: inbound/outbound media cap (MB, default 10).
- `channels.mezon.host`: gateway host (default: gw.mezon.ai).
- `channels.mezon.port`: gateway port (default: 443).
- `channels.mezon.useSSL`: use TLS (default: true).

Multi-account options:
- `channels.mezon.accounts.<id>.botId`: per-account bot ID.
- `channels.mezon.accounts.<id>.botToken`: per-account bot token.
- `channels.mezon.accounts.<id>.tokenFile`: per-account token file.
- `channels.mezon.accounts.<id>.name`: display name.
- `channels.mezon.accounts.<id>.enabled`: enable/disable account.
- `channels.mezon.accounts.<id>.dmPolicy`: per-account DM policy.
- `channels.mezon.accounts.<id>.allowFrom`: per-account allowlist.
- `channels.mezon.accounts.<id>.mediaMaxMb`: per-account media cap.
- `channels.mezon.accounts.<id>.host`: per-account gateway host.
- `channels.mezon.accounts.<id>.port`: per-account gateway port.
- `channels.mezon.accounts.<id>.useSSL`: per-account TLS setting.
