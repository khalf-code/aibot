# @openclaw/mezon

Mezon channel plugin for OpenClaw (Bot SDK).

## Install (local checkout)

```bash
openclaw plugins install ./extensions/mezon
```

## Install (npm)

```bash
openclaw plugins install @openclaw/mezon
```

Onboarding: select Mezon and confirm the install prompt to fetch the plugin automatically.

## Config

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

## Env

```bash
MEZON_BOT_ID=1840692863290052608
MEZON_BOT_TOKEN=your-bot-token
```

Works for the default account only.

## Token file

```json5
{
  channels: {
    mezon: {
      tokenFile: "/path/to/mezon-token.txt"
    }
  }
}
```

Format: `botId:token` or `token` (with botId in config or env).

## Group messages

Group messages must start with `#` to be processed. Example: `#Hello bot`.

Restart the gateway after config changes.
