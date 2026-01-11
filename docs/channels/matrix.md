---
summary: "Matrix client setup, E2EE verification, DMs, rooms, threading, and configuration"
read_when:
  - Setting up the Matrix channel
  - Debugging Matrix E2EE or verification
  - Configuring Matrix rooms or DMs
---

# Matrix (Client-Server API)

Updated: 2026-01-11

Status: production-ready for DMs + rooms via `matrix-js-sdk`. Node-only with E2EE using Rust crypto.

## Quick setup (beginner)

1) Create a Matrix account (or use an existing one) on any homeserver.
2) Get an access token via password login or generate one from Element.
3) Configure Clawdbot with the credentials.
4) If using E2EE: set `encryption: true` and run device verification.
5) Start the gateway and verify the device if E2EE is enabled.

Minimal config:
```json5
{
  matrix: {
    enabled: true,
    homeserver: "https://matrix.example.org",
    userId: "@clawdbot:example.org",
    accessToken: "syt_...",
    encryption: true
  }
}
```

## Goals

- Talk to Clawdbot via Matrix DMs or rooms.
- Direct chats collapse into the agent's main session (default `agent:main:main`).
- Rooms are isolated as `agent:<agentId>:matrix:channel:<roomId>`.
- Keep routing deterministic: replies always go back to the channel they arrived on.

## Runtime requirements

Matrix uses the official `matrix-js-sdk` with Rust crypto. That means:

- **Node.js only** runtime (Bun is unsupported for Matrix due to native crypto dependencies).
- E2EE is **on by default** (`matrix.encryption: true`). Set `matrix.encryption: false` to disable.
- For **verified encryption** (no warning icons), verify the "Clawdbot Gateway" device in your Matrix client.

### Storage locations

- Crypto state is persisted to `~/.clawdbot/matrix-crypto/` using a user-specific IndexedDB database (fake-indexeddb for Node.js).
- Password login credentials are cached to `~/.clawdbot/credentials/matrix/` for reuse across restarts.

## Authentication

Matrix does not have a dedicated "bot token" system like Telegram or Discord. You use a standard user account.

### Option 1: Access token (recommended)

Generate an access token via password login:

```bash
curl -sS "https://matrix.example.org/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "identifier": { "type": "m.id.user", "user": "@clawdbot:example.org" },
    "password": "YOUR_PASSWORD"
  }'
```

The response includes:
- `access_token` → set as `matrix.accessToken`
- `user_id` → set as `matrix.userId`

Then configure:
```json5
{
  matrix: {
    homeserver: "https://matrix.example.org",
    userId: "@clawdbot:example.org",
    accessToken: "syt_...",
    encryption: true
  }
}
```

### Option 2: Password login (runtime)

If you set `matrix.password`, Clawdbot will log in at startup to obtain a token. The credentials are cached to `~/.clawdbot/credentials/matrix/` for reuse.

For long-running gateways, prefer a pre-generated `accessToken`.

```json5
{
  matrix: {
    homeserver: "https://matrix.example.org",
    userId: "@clawdbot:example.org",
    password: "YOUR_PASSWORD",
    encryption: true
  }
}
```

## End-to-End Encryption (E2EE)

### Enabling encryption

Set `matrix.encryption: true` in your config. This initializes the Rust crypto module and enables reading/sending encrypted messages.

### Cross-signing and verification

Matrix uses a "Web of Trust" model. When you first log in, the server knows who you are (via password/token), but other users' devices don't trust your new device yet. Verification proves that this device is controlled by you.

#### Why verify?

Without verification:
- Your bot may be unable to read history from encrypted rooms.
- Other users see a "warning" shield next to messages sent by your bot, indicating its trust status is unknown.
- Some security-conscious users block messages from unverified devices.

#### SAS verification

Matrix uses SAS (emoji/number comparison) to verify devices. Start verification from your Matrix client (Element: Settings -> Security & Privacy -> Sessions) and verify the "Clawdbot Gateway" device when prompted.

## DM configuration

### DM policy

Control who can DM your bot:

- `pairing` (default): Unknown senders receive a pairing code. Approve with `clawdbot pairing approve matrix <code>`.
- `allowlist`: Only senders in `matrix.dm.allowFrom` can message.
- `open`: Anyone can DM; if `matrix.dm.allowFrom` is set, include `"*"` to keep it open.
- `disabled`: Block all DMs.

```json5
{
  matrix: {
    dm: {
      enabled: true,
      policy: "pairing",
      allowFrom: ["@alice:example.org", "@bob:example.org"]
    }
  }
}
```

### Pairing flow

When `dm.policy: "pairing"` and an unknown sender messages:

1. The bot replies with a pairing code:
   ```
   Clawdbot: access not configured.
   
   Pairing code: ABC123
   
   Ask the bot owner to approve with:
   clawdbot pairing approve --provider matrix <code>
   ```

2. Approve the sender:
   ```bash
   clawdbot pairing list --provider matrix
   clawdbot pairing approve --provider matrix ABC123
   ```

3. The sender is added to the local allowlist and can now message freely.

### DM detection

Matrix DM detection uses multiple signals:
1. **m.direct account data**: Primary source for identifying DM rooms.
2. **is_direct flag**: Fallback when `m.direct` is missing.
3. **2-member room heuristic**: Last resort for 1:1 rooms.

## Room configuration

### Group policy

Control which rooms your bot responds in:

- `disabled` (default): Block all room messages.
- `open`: Rooms bypass allowlists; mention gating still applies.
- `allowlist`: Only rooms listed in `matrix.rooms` are allowed.

```json5
{
  matrix: {
    groupPolicy: "allowlist",
    rooms: {
      "!roomid:example.org": { allow: true, requireMention: true },
      "#ops:example.org": { allow: true, requireMention: false }
    }
  }
}
```

### Per-room settings

```json5
{
  matrix: {
    rooms: {
      "*": { requireMention: true },  // default for all rooms
      "!specific:example.org": {
        enabled: true,           // alias for allow
        allow: true,
        autoReply: false,        // when true, don't require mention
        requireMention: true,    // require @mention to respond
        skills: ["docs", "code"], // skill filter (omit = all skills)
        systemPrompt: "Keep answers short and technical.",
        users: ["@alice:example.org"]  // per-room user allowlist
      }
    }
  }
}
```

### Auto-join

Control automatic room joins on invite:

- `always` (default): Accept all invites.
- `allowlist`: Only join rooms in `matrix.autoJoinAllowlist`.
- `off`: Never auto-join.

```json5
{
  matrix: {
    autoJoin: "allowlist",
    autoJoinAllowlist: ["!roomid:example.org", "#ops:example.org"]
  }
}
```

## Threads and replies

### Thread replies

Matrix threads are fully supported. Control behavior with `matrix.threadReplies`:

- `inbound` (default): Reply in a thread only if the sender started one.
- `always`: Always reply in threads (create new thread if none exists).
- `off`: Never use thread replies.

When an inbound message is a thread reply, Clawdbot follows the thread automatically.

### Reply-to mode

Control non-thread reply tags with `matrix.replyToMode`:

- `off` (default): Don't add reply relations.
- `first`: Reply-to on first message only.
- `all`: Reply-to on all messages.

## Sending messages (CLI/cron)

Deliver messages to rooms using the CLI:

```bash
# By room ID
clawdbot message send --provider matrix --to "room:!roomid:example.org" --message "hello"

# By alias
clawdbot message send --provider matrix --to "#channel:example.org" --message "hello"

# Direct message (requires existing DM room via m.direct)
clawdbot message send --provider matrix --to "user:@alice:example.org" --message "hello"
```

Short form targets:
- `room:<roomId>` or just `!roomid:example.org`
- `#alias:example.org` (resolved to room ID)
- `user:@userid:example.org` or `@userid:example.org` (DM via m.direct lookup)

## Agent tool

The `matrix` tool allows the agent to interact with Matrix programmatically.

### Available actions

| Action | Description | Required params |
|--------|-------------|-----------------|
| `sendMessage` | Send a message | `to`, `content` |
| `editMessage` | Edit a message | `roomId`, `messageId`, `content` |
| `deleteMessage` | Delete (redact) a message | `roomId`, `messageId` |
| `readMessages` | Read room history | `roomId` |
| `react` | Add/remove reaction | `roomId`, `messageId`, `emoji` |
| `reactions` | List reactions on message | `roomId`, `messageId` |
| `pinMessage` | Pin a message | `roomId`, `messageId` |
| `unpinMessage` | Unpin a message | `roomId`, `messageId` |
| `listPins` | List pinned messages | `roomId` |
| `memberInfo` | Get user info | `userId` |
| `roomInfo` | Get room info | `roomId` |

### Action gating

Control which actions are enabled:

```json5
{
  matrix: {
    actions: {
      messages: true,    // sendMessage, editMessage, deleteMessage, readMessages
      reactions: true,   // react, reactions
      pins: true,        // pinMessage, unpinMessage, listPins
      memberInfo: true,  // memberInfo
      roomInfo: true     // roomInfo
    }
  }
}
```

## Polls

Matrix polls are supported via the MSC3381 poll format. Inbound polls are converted to text for agent processing:

```
📊 Poll from Alice: "What should we order for lunch?"
Options:
1. Pizza
2. Sushi
3. Tacos
[Poll ID: $eventid123]
```

Send polls via CLI:
```bash
clawdbot message poll --provider matrix --to "room:!roomid:example.org" \
  --question "What should we order?" \
  --options "Pizza,Sushi,Tacos"
```

## Capabilities and limits

### What works

- ✅ Encrypted + unencrypted rooms (E2EE with Rust crypto)
- ✅ DMs and group rooms
- ✅ Threads and reply relations
- ✅ Typing indicators
- ✅ Reactions (add/remove/list)
- ✅ Message editing and deletion (redaction)
- ✅ Pinned messages
- ✅ Room/member info queries
- ✅ Media uploads via Matrix content repository
- ✅ Encrypted media in E2EE rooms (download + upload)
- ✅ Polls (MSC3381)

### Limits

- Text chunked to `matrix.textChunkLimit` (default: 4000 chars).
- Media capped by `matrix.mediaMaxMb` (default: 20 MB).
- **Node.js only** — Bun runtime is not supported due to native crypto dependencies.

## Full configuration reference

```json5
{
  matrix: {
    // Provider control
    enabled: true,                        // enable/disable the provider
    
    // Authentication
    homeserver: "https://matrix.example.org",
    userId: "@clawdbot:example.org",
    accessToken: "syt_...",               // preferred auth method
    password: "...",                       // alternative: login at startup
    deviceName: "Clawdbot Gateway",       // display name for device
    
    // Encryption
    encryption: true,                     // enable E2EE
    
    // Storage (defaults usually fine)
    storePath: "~/.clawdbot/credentials/matrix/store",
    cryptoStorePath: "~/.clawdbot/credentials/matrix/crypto",
    
    // Auto-join behavior
    autoJoin: "always",                   // always | allowlist | off
    autoJoinAllowlist: ["!roomid:example.org", "#ops:example.org"],
    
    // Room handling
    groupPolicy: "disabled",              // open | allowlist | disabled
    allowlistOnly: false,                 // require allowlists for all
    
    // DM handling
    dm: {
      enabled: true,
      policy: "pairing",                  // pairing | allowlist | open | disabled
      allowFrom: ["@owner:example.org", "*"]
    },
    
    // Per-room config
    rooms: {
      "*": { requireMention: true },
      "!roomid:example.org": {
        allow: true,
        autoReply: false,
        skills: ["docs"],
        systemPrompt: "Keep answers short."
      }
    },
    
    // Threading
    replyToMode: "off",                   // off | first | all
    threadReplies: "inbound",             // inbound | always | off
    
    // Limits
    textChunkLimit: 4000,
    mediaMaxMb: 20,
    initialSyncLimit: 10,                 // events per room on initial sync
    
    // Tool gating
    actions: {
      messages: true,
      reactions: true,
      pins: true,
      memberInfo: true,
      roomInfo: true
    }
  }
}
```

### Environment variables

All config options can be overridden via environment variables (env wins):

| Variable | Config key |
|----------|------------|
| `MATRIX_HOMESERVER` | `matrix.homeserver` |
| `MATRIX_USER_ID` | `matrix.userId` |
| `MATRIX_ACCESS_TOKEN` | `matrix.accessToken` |
| `MATRIX_PASSWORD` | `matrix.password` |
| `MATRIX_DEVICE_NAME` | `matrix.deviceName` |
| `MATRIX_STORE_PATH` | `matrix.storePath` |
| `MATRIX_CRYPTO_STORE_PATH` | `matrix.cryptoStorePath` |

## Routing and sessions

Session keys follow the standard agent format:

- **DMs**: Share the main session (`agent:<agentId>:<mainKey>`)
- **Rooms**: Isolated by room (`agent:<agentId>:matrix:channel:<roomId>`)

The `From` field in context:
- DMs: `matrix:@userid:example.org`
- Rooms: `matrix:channel:!roomid:example.org`

## Troubleshooting

### Bot can't read encrypted messages

1. Ensure `matrix.encryption: true` is set.
2. Verify the device is trusted in your main Matrix client.

### "Matrix requires Node.js" error

Matrix provider uses Rust crypto bindings that don't work with Bun. Run the gateway with Node.js:
```bash
node dist/bin/clawdbot.js gateway
```

### DMs not working

1. Check `matrix.dm.enabled` is true.
2. Check `matrix.dm.policy` — if `pairing`, approve pending requests.
3. For `allowlist` policy, verify the sender is in `matrix.dm.allowFrom`.

### Room messages ignored

1. Check `matrix.groupPolicy` — it's `disabled` by default.
2. For `allowlist` policy, add the room to `matrix.rooms`.
3. Check if mention is required but bot wasn't mentioned.

## References

- [Matrix Client-Server API](https://spec.matrix.org/latest/client-server-api/)
- [matrix-js-sdk documentation](https://matrix-org.github.io/matrix-js-sdk/)
- [Matrix E2EE guide](https://matrix.org/docs/guides/end-to-end-encryption-implementation-guide)
- [MSC3381 Polls](https://github.com/matrix-org/matrix-spec-proposals/pull/3381)
