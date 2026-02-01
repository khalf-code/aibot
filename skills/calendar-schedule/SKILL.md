# calendar-schedule

Query and report on calendar events using icalBuddy.

## Usage

```bash
# Get today's events
~/moltbot/skills/calendar-schedule/scripts/get-today.sh

# Get today's events as JSON
~/moltbot/skills/calendar-schedule/scripts/get-today.sh --json

# Get next 7 days of events
~/moltbot/skills/calendar-schedule/scripts/get-week.sh

# Get next 7 days as JSON
~/moltbot/skills/calendar-schedule/scripts/get-week.sh --json

# Generate markdown report for daily-reporter
~/moltbot/skills/calendar-schedule/scripts/generate-report.sh
```

## Scripts

### get-today.sh
Returns today's calendar events in plain text or JSON format.

**Options:**
- `--json` - Output as JSON array with title and time
- `--help` - Show help message

**Output (text):**
```
• Event Title
  14:30 - 15:30
• Another Event
  09:00
```

**Output (JSON):**
```json
[
  {"title": "Event Title", "time": "14:30 - 15:30"},
  {"title": "Another Event", "time": "09:00"}
]
```

### get-week.sh
Returns next 7 days of calendar events in plain text or JSON format.

**Options:**
- `--json` - Output as JSON array with title, date, and time
- `--help` - Show help message

**Output (text):**
```
2026-02-01
• Event Title
  14:30 - 15:30
2026-02-02
• Another Event
  09:00
```

**Output (JSON):**
```json
[
  {"title": "Event Title", "date": "2026-02-01", "time": "14:30 - 15:30"},
  {"title": "Another Event", "date": "2026-02-02", "time": "09:00"}
]
```

### generate-report.sh
Generates a markdown report of today's events suitable for daily-reporter integration.

**Output:**
```markdown
## 📅 Today's Schedule

- **14:30 - 15:30** - Event Title
- **09:00** - Another Event
```

## Configuration

Edit `references/config.json` to customize:
- `exclude_calendars` - Calendar names to exclude from results
- `output_format` - Default output format (text or json)
- `time_format` - Time display format
- `date_format` - Date display format

## Dependencies

- icalBuddy: Calendar access via macOS Calendar app
- jq: JSON parsing for config

## Implementation Notes

- Uses icalBuddy for calendar access (NOT osascript/AppleScript)
- Read-only operations - no calendar modifications
- Excludes holidays, birthdays, and reminders by default
- Reuses patterns from morning-briefing skill
