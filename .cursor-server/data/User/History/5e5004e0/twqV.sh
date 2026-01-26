#!/bin/bash
# Liam's Visual Timer
# Wraps clawdbot cron for one-shot timers

DURATION=$1
TASK=$2

if [ -z "$DURATION" ] || [ -z "$TASK" ]; then
  echo "Usage: timer <duration> <task>"
  echo "Example: timer 30m 'Deep work session'"
  exit 1
fi

# Clean duration (remove + if present)
WHEN="${DURATION#+}"

NAME="Timer: $TASK"
MESSAGE="⏰ **Timer is up!**\n\n**Task:** $TASK\n**Duration:** $DURATION"

# Use pnpm to run clawdbot from the project root
cd /home/liam/clawdbot
pnpm run clawdbot cron add \
  --name "$NAME" \
  --at "$WHEN" \
  --session isolated \
  --message "$MESSAGE" \
  --deliver \
  --delete-after-run \
  --thinking off \
  --post-prefix "Timer"

echo "✅ Timer set for $DURATION: $TASK"
