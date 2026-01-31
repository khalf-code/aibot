---
summary: "Connect a Telegram user account via MTProto (DMs + groups)"
---
# Telegram User

Telegram User connects OpenClaw to a **Telegram user session** using MTProto.
Use it for higher media limits and full group visibility. Run it on a **dedicated account** (not your main personal/work account) to avoid risking your primary identity.

## Requirements

- Telegram API ID + API hash from [my.telegram.org](https://my.telegram.org).
- The `telegram-user` plugin installed.

## Install the plugin

If the plugin is not bundled, install it:

```bash
openclaw plugins install @openclaw/telegram-user
```

## Configure

You can store credentials in config or use env vars.

Option A: env vars (default account only)
```bash
export TELEGRAM_USER_API_ID="123456"
export TELEGRAM_USER_API_HASH="your_api_hash"
openclaw channels add --channel telegram-user --use-env
```

Option B: config
```bash
openclaw channels add --channel telegram-user --api-id 123456 --api-hash your_api_hash
```

## When to use this instead of the Bot API

- **Bigger media**: Matches the app (up to 2 GB; 4 GB with Telegram Premium). The hosted Bot API caps uploads at 50 MB.
- **Full visibility**: Sees everything that user sees (including forums/topics). Bot API can miss posts when privacy mode is on or the bot lacks admin rights.
- **Run alongside the bot**: Keep the Bot API channel for public/automation flows; use this for heavy media and full visibility. Always keep this session on its own dedicated account/SIM.

## Login (QR or phone code)

QR login (default):
```bash
openclaw channels login --channel telegram-user
```

Phone login:
```bash
export TELEGRAM_USER_PHONE="+15551234567"
openclaw channels login --channel telegram-user
```

Optional env helpers:
- `TELEGRAM_USER_CODE` (one-time code)
- `TELEGRAM_USER_PASSWORD` (2FA password)

## Security (DM policy)

By default, DMs are protected with pairing. Approve requests with:

```bash
openclaw pairing approve telegram-user <code>
```

See [Pairing](/start/pairing) for details.

## Limitations

- Broadcast channels are not supported.
- Calls are not supported.
