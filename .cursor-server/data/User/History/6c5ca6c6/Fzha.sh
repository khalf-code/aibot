#!/bin/bash
# Liam's CLI Command Library
# Reusable functions for common tasks

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_header() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"; }

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Run gog Gmail check
check_email() {
  print_header "Checking Email (clawdbot@puenteworks.com)"

  if ! command_exists gog; then
    print_error "gog command not found"
    return 1
  fi

  local result=$(gog gmail messages search "in:inbox is:unread" --account clawdbot@puenteworks.com --max 10 2>&1)

  if echo "$result" | grep -q "No results"; then
    print_success "No unread emails"
  elif echo "$result" | grep -q "error"; then
    print_error "Gmail check failed: $result"
  else
    print_info "Unread emails found"
    echo "$result"
  fi
}

# Check Google Calendar
check_calendar() {
  print_header "Checking Calendar (clawdbot@puenteworks.com)"

  if ! command_exists gog; then
    print_error "gog command not found"
    return 1
  fi

  local result=$(gog calendar events list --account clawdbot@puenteworks.com --days 1 2>&1)

  if echo "$result" | grep -q "error"; then
    print_error "Calendar check failed: $result"
  else
    print_success "Calendar checked"
    echo "$result"
  fi
}

# Note capture with timestamp
add_note() {
  local content="$1"
  local tags="${2:-general}"
  local date=$(date +%Y-%m-%d)
  local time=$(date +%H:%M:%S)

  local note_file="$HOME/clawd/memory/$date.md"

  # Ensure memory directory exists
  mkdir -p "$HOME/clawd/memory"

  # Append note to daily file
  echo -e "\n## $time - Note ($tags)\n$content" >> "$note_file"

  print_success "Note saved to $note_file"
}

# Show system status
show_status() {
  print_header "Liam Status"

  # Check if running (we're running if this script executes)
  if [ -n "$CLAWDBOT_RUNTIME" ] || pgrep -f "clawdbot" > /dev/null; then
    print_success "Clawdbot is running"
  else
    # We're being called from terminal, check if agent session is active
    print_warning "Cannot determine Clawdbot status (running via terminal)"
  fi

  # Check workspace
  if [ -d "$HOME/clawd" ]; then
    print_success "Workspace exists: $HOME/clawd"
  else
    print_error "Workspace not found"
  fi

  # Check drive
  if [ -d "/home/liam" ]; then
    local space=$(df -h "/home/liam" | tail -1 | awk '{print $4}')
    print_success "Home directory: $space free"
  else
    print_error "Home directory not found"
  fi

  # Check tools
  print_header "Tool Status"
  command_exists gog && print_success "gog installed" || print_error "gog not installed"
  command_exists imsg && print_success "imsg installed" || print_warning "imsg not installed"
  command_exists gh && print_success "gh installed" || print_warning "gh not installed"
}

# Quick project status
project_status() {
  local project_dir="$1"

  if [ ! -d "$project_dir" ]; then
    print_error "Project directory not found: $project_dir"
    return 1
  fi

  cd "$project_dir" || return 1

  print_header "Project: $(basename $project_dir)"

  # Git status
  if [ -d ".git" ]; then
    print_info "Git Branch: $(git branch --show-current)"
    print_info "Git Status: $(git status --short | wc -l | tr -d ' ') modified files"
  else
    print_warning "Not a git repository"
  fi
}

# Context Cue for ADHD
get_context_cue() {
  print_header "Focus Context"
  
  # 1. Check Calendar
  local events=$(gog calendar events primary --from today --to today --account clawdbot@puenteworks.com --json | jq -r '.events[0].summary' 2>/dev/null)
  
  # 2. Check PARA Tasks
  local task=$(python3 /home/liam/clawdbot/skills/para-tasks/scripts/task.py list | sed -n '3p' | awk '{print $2, $3, $4}')
  
  if [ -n "$events" ]; then
    print_info "Calendar: You have '$events' today."
  fi
  
  if [ -n "$task" ]; then
    print_info "Next Task: $task"
    echo -e "\n🎯 **Suggestion:** Focus on '$task'. Want me to set a 25m timer?"
  else
    print_warning "No active tasks found in PARA system."
  fi
}

