#!/bin/bash

# Get today's calendar events using icalBuddy
# Usage: get-today.sh [--json] [--help]

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
Get today's calendar events

Usage: get-today.sh [OPTIONS]

Options:
  --json    Output as JSON array
  --help    Show this help message

Examples:
  get-today.sh              # Plain text output
  get-today.sh --json       # JSON output
EOF
}

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | tr -d '\n'
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

get_events_json() {
  local title=""
  local time=""
  local first=true
  
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    
    if [[ "$line" == •* ]]; then
      if [ -n "$title" ] && [ -n "$time" ]; then
        if [ "$first" = true ]; then
          first=false
        else
          printf ',\n'
        fi
        local escaped_title=$(escape_json "$title")
        local escaped_time=$(escape_json "$time")
        printf '  {"title": "%s", "time": "%s"}' "$escaped_title" "$escaped_time"
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
    if [ "$first" = true ]; then
      first=false
    else
      printf ',\n'
    fi
    local escaped_title=$(escape_json "$title")
    local escaped_time=$(escape_json "$time")
    printf '  {"title": "%s", "time": "%s"}' "$escaped_title" "$escaped_time"
  fi
}

# Parse arguments
case "${1:-}" in
  --json)
    echo "["
    get_events_json
    echo ""
    echo "]"
    ;;
  --help)
    show_help
    ;;
  "")
    get_today_events_raw
    ;;
  *)
    echo "Error: Unknown option '$1'" >&2
    show_help >&2
    exit 1
    ;;
esac
