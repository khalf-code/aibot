#!/bin/bash

# Generate markdown report of calendar events for daily-reporter
# Usage: generate-report.sh [--help]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/references/config.json"
ICALBUDDY="/opt/homebrew/bin/icalBuddy"

# Load config
if [[ -f "$CONFIG_FILE" ]]; then
  EXCLUDE_CALENDARS=$(jq -r '.calendar.exclude_calendars | join(",")' "$CONFIG_FILE" 2>/dev/null || echo "Birthdays,Reminders")
else
  EXCLUDE_CALENDARS="Birthdays,Reminders"
fi

show_help() {
  cat << 'EOF'
Generate markdown report of today's calendar events

Usage: generate-report.sh [OPTIONS]

Options:
  --help    Show this help message

Output:
  Markdown-formatted calendar report suitable for daily-reporter integration

Examples:
  generate-report.sh > report.md
EOF
}

escape_markdown() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/\[/\\[/g; s/\]/\\]/g'
}

extract_time() {
  echo "$1" | grep -oE '[0-9]{1,2}:[0-9]{2}[[:space:]]*-[[:space:]]*[0-9]{1,2}:[0-9]{2}' || \
  echo "$1" | grep -oE '[0-9]{1,2}:[0-9]{2}' || \
  echo ""
}

get_today_events_raw() {
  "$ICALBUDDY" \
    -ec "$EXCLUDE_CALENDARS" \
    -nc \
    -tf '%H:%M' \
    eventsToday 2>/dev/null || true
}

generate_markdown_report() {
  local title=""
  local time=""
  local has_events=false
  
  echo "## 📅 Today's Schedule"
  echo ""
  
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    
    if [[ "$line" == •* ]]; then
      if [ -n "$title" ] && [ -n "$time" ]; then
        has_events=true
        local escaped_title=$(escape_markdown "$title")
        echo "- **$time** - $escaped_title"
      fi
      title="${line#• }"
      time=""
    elif [[ "$line" =~ ^[[:space:]]+ ]]; then
      local extracted=$(extract_time "$line")
      if [ -n "$extracted" ]; then
        time="$extracted"
      fi
    fi
  done < <(get_today_events_raw)
  
  if [ -n "$title" ] && [ -n "$time" ]; then
    has_events=true
    local escaped_title=$(escape_markdown "$title")
    echo "- **$time** - $escaped_title"
  fi
  
  if [ "$has_events" = false ]; then
    echo "No events scheduled for today."
  fi
  
  echo ""
}

# Parse arguments
case "${1:-}" in
  --help)
    show_help
    ;;
  "")
    generate_markdown_report
    ;;
  *)
    echo "Error: Unknown option '$1'" >&2
    show_help >&2
    exit 1
    ;;
esac
