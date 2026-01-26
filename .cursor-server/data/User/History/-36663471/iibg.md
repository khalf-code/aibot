---
name: visual-timer
description: Set visual timers and reminders via Slack to help with time blindness and deep work. Use when Simon needs to track time for a task or wants a proactive nudge after a specific duration.
---

# Visual Timer Skill

Set one-shot timers that will alert you via Slack when time is up. This is specifically designed to support neurodivergent focus and combat time blindness.

## Usage

Set a timer for a specific duration and task:

```bash
# Set a 30 minute timer
scripts/timer.sh 30m "Deep work session"

# Set a 5 minute timer
scripts/timer.sh 5m "Check the oven"

# Set a 1 hour timer
scripts/timer.sh 1h "Call back client"
```

## Features

- **Relative Timing**: Supports `m` (minutes), `h` (hours), and `s` (seconds).
- **Proactive Alerts**: Liam will ping you on Slack when the time is up.
- **Task Context**: Every timer includes the task name so you don't forget why it was set.
- **One-Shot**: Timers are automatically cleaned up after they run.

## Tips for Neurodivergent Users

- **Time-Boxing**: Use `/timer 25m 'Focus block'` for Pomodoro-style work.
- **Transition Cues**: Set a timer for 5 minutes before a meeting to help with set-shifting.
- **Object Permanence**: Use timers for physical tasks (like laundry or cooking) that might slip out of mind.
