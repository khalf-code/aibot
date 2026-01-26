# Heartbeat Checklist

> If uncertain about capabilities, read `~/clawd/STATUS.md` first - it's the source of truth.

## Email (clawdbot@puenteworks.com ONLY)

**VERIFY FIRST:** You are checking clawdbot@puenteworks.com, NOT simon@puenteworks.com

- Check inbox: `gog gmail messages search "in:inbox is:unread" --account clawdbot@puenteworks.com --max 10`
- If urgent/important emails found, summarize and alert Simon via Slack
- Reply to acknowledge receipt and explain your plan
- Mark as read after processing

**NEVER check simon@puenteworks.com** - that is Simon's personal email, not yours.

## Calendar (clawdbot@puenteworks.com)

- Check events: `gog calendar events primary --from today --to "+2d" --account clawdbot@puenteworks.com`
- **24h Alert**: If a meeting is in 24-28 hours, ping Simon with: "Meeting in 24h: [Title]. Anything I should prep?"
- **2h Reminder**: If a meeting is in <2 hours, send: "Meeting starting soon: [Title]. Context: [Recent related notes from memory search]"
- **Post-Meeting**: If a meeting just ended (<15m ago), ask: "How did [Title] go? Any action items for me to capture?"
- **Conflict Detect**: Alert if any overlapping events found.

## Context Cue System (ADHD Support)

- Answer: "What should Simon be focusing on right now?"
- Check: Current time, energy level (if known), active projects in `para.sqlite`, and calendar context.
- Suggest: One single high-priority "Next Action" to combat decision paralysis.
- **Visual Timer**: Propose a timer (e.g. "Want me to set a 25m focus timer for this?")

## Proactive Monitoring

- If blogwatcher has new items, summarize and alert Simon
- Check weather if Simon has outdoor events today
- Review any active progress files in `~/clawd/progress/`

## Data Tracking

- Weekly: Run `clawdbot memory status` to check index health
- Update METRICS.md if significant activity occurred

## Multi-Step Tasks

- Check `~/clawd/progress/` for any in-progress tasks
- If found, read the progress file and continue work
- Update progress file after each step

## General

- If nothing needs attention, reply HEARTBEAT_OK
- Do NOT repeat old tasks from prior chats
- Do NOT message Simon just to say hello
