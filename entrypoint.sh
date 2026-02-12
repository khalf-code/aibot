#!/bin/sh
set -e

# Créer le dossier de config Clawdbot
mkdir -p /root/.clawdbot

# Générer la config de base
cat > /root/.clawdbot/clawdbot.json << JSONEOF
{
  "agent": {
    "model": "${MODEL_ID:-anthropic/claude-opus-4-5}"
  },
  "agents": {
    "defaults": {
      "systemPrompt": "${SYSTEM_PROMPT:-You are a helpful assistant.}"
    }
  },
  "channels": {}
}
JSONEOF

# Injecter config Telegram si le token existe
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('/root/.clawdbot/clawdbot.json'));
    cfg.channels.telegram = { botToken: process.env.TELEGRAM_BOT_TOKEN };
    fs.writeFileSync('/root/.clawdbot/clawdbot.json', JSON.stringify(cfg, null, 2));
  "
fi

# Injecter config Discord si le token existe
if [ -n "$DISCORD_BOT_TOKEN" ]; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('/root/.clawdbot/clawdbot.json'));
    cfg.channels.discord = { token: process.env.DISCORD_BOT_TOKEN };
    fs.writeFileSync('/root/.clawdbot/clawdbot.json', JSON.stringify(cfg, null, 2));
  "
fi

# Injecter config Slack si les tokens existent
if [ -n "$SLACK_BOT_TOKEN" ]; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('/root/.clawdbot/clawdbot.json'));
    cfg.channels.slack = { botToken: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN || '' };
    fs.writeFileSync('/root/.clawdbot/clawdbot.json', JSON.stringify(cfg, null, 2));
  "
fi

echo "=== Clawdbot config generated ==="
cat /root/.clawdbot/clawdbot.json
echo "================================="

# Lancer Clawdbot
exec node dist/index.js
