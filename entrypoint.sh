#!/bin/sh

set -e

mkdir -p ~/.openclaw

cat > ~/.openclaw/openclaw.json << JSONEOF
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "${MODEL_ID:-openai/gpt-4o}"
      }
    },
    "list": [
      {
        "id": "main",
        "identity": {
          "name": "Agent",
          "theme": "${SYSTEM_PROMPT:-You are a helpful assistant.}"
        }
      }
    ]
  },
  "channels": {}
}
JSONEOF

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  node -e "
    const fs = require('fs');
    const p = require('os').homedir() + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(fs.readFileSync(p));
    cfg.channels.telegram = { botToken: process.env.TELEGRAM_BOT_TOKEN };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  "
fi

if [ -n "$DISCORD_BOT_TOKEN" ]; then
  node -e "
    const fs = require('fs');
    const p = require('os').homedir() + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(fs.readFileSync(p));
    cfg.channels.discord = { token: process.env.DISCORD_BOT_TOKEN };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  "
fi

if [ -n "$SLACK_BOT_TOKEN" ]; then
  node -e "
    const fs = require('fs');
    const p = require('os').homedir() + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(fs.readFileSync(p));
    cfg.channels.slack = { botToken: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN || '' };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  "
fi

echo "=== OpenClaw config generated ==="
cat ~/.openclaw/openclaw.json
echo "================================="

exec node /app/openclaw.mjs gateway --allow-unconfigured --bind 0.0.0.0 --port ${PORT:-10000}

