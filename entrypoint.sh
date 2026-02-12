#!/bin/sh

set -e

# Créer le dossier de config
mkdir -p ~/.openclaw

# Générer la config de base (format v2 : pas de "agent", tout dans "agents.defaults")
cat > ~/.openclaw/openclaw.json << JSONEOF
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "${MODEL_ID:-openai/gpt-4o}"
      },
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
    const p = require('os').homedir() + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(fs.readFileSync(p));
    cfg.channels.telegram = { botToken: process.env.TELEGRAM_BOT_TOKEN };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  "
fi

# Injecter config Discord si le token existe
if [ -n "$DISCORD_BOT_TOKEN" ]; then
  node -e "
    const fs = require('fs');
    const p = require('os').homedir() + '/.openclaw/openclaw.json';
    const cfg = JSON.parse(fs.readFileSync(p));
    cfg.channels.discord = { token: process.env.DISCORD_BOT_TOKEN };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  "
fi

# Injecter config Slack si les tokens existent
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

# Lancer OpenClaw
exec node /app/openclaw.mjs gateway --allow-unconfigured --bind lan --port ${PORT:-10000}
