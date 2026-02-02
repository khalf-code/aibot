---
name: bluebubbles
description: Use when you need to send or manage iMessages via BlueBubbles (recommended iMessage integration). Calls go through the generic message tool with channel="bluebubbles".
metadata: {"openclaw":{"emoji":"🫧","requires":{"config":["channels.bluebubbles"]}}}
---

# BlueBubbles (iMessage)

BlueBubbles is OpenClaw’s **recommended** iMessage integration.

Use the **`message` tool** with `channel: "bluebubbles"` to:

- send texts and attachments
- react (tapbacks)
- edit / unsend
- reply-to (threading)
- rename groups / set group icon
- add/remove participants / leave groups

## What to collect

- **Target** (required for most actions):
  - best: `chat_guid:...` (stable for groups)
  - ok: `+15551234567` (E.164), `user@example.com`
- **Text** (for send/edit/reply)
- **Message id** (for react/edit/unsend/reply)
- **Attachment** (path or base64 buffer + filename)

If the user is vague (“text my mom”), ask for:
- recipient handle (phone/email) or explicit chat guid
- the exact message content

## Common actions

### Send a message

```json
{
  "action": "send",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "message": "hello from OpenClaw"
}
```

### React (tapback)

```json
{
  "action": "react",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "messageId": "<message-guid>",
  "emoji": "❤️"
}
```

Remove a reaction:

```json
{
  "action": "react",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "messageId": "<message-guid>",
  "emoji": "❤️",
  "remove": true
}
```

### Edit a previously sent message

```json
{
  "action": "edit",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "messageId": "<message-guid>",
  "message": "updated text"
}
```

### Unsend

```json
{
  "action": "unsend",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "messageId": "<message-guid>"
}
```

### Reply to a specific message

```json
{
  "action": "reply",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "replyTo": "<message-guid>",
  "message": "replying to that"
}
```

### Send an attachment

```json
{
  "action": "sendAttachment",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "path": "/tmp/photo.jpg",
  "caption": "here you go"
}
```

### Send with an iMessage effect

```json
{
  "action": "sendWithEffect",
  "channel": "bluebubbles",
  "target": "+15551234567",
  "message": "big news",
  "effect": "balloons"
}
```

## Notes

- Prefer `chat_guid` targets when you have them (especially for group chats).
- BlueBubbles supports rich actions, but some are macOS-version dependent (for example, edit may be broken on macOS 26 Tahoe).
- The gateway may expose both short and full message ids; full ids are more durable across restarts.
