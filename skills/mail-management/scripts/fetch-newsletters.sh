#!/bin/bash

# fetch-newsletters.sh - Fetch newsletters by sender/subject patterns
# Usage: fetch-newsletters.sh [OPTIONS]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
MAIL_SCRIPT="/Users/koed/moltbot/skills/himalaya/scripts/mail.sh"
CONFIG_FILE="$SKILL_DIR/references/newsletter-senders.json"

DRY_RUN=false
ACCOUNT=""
LIMIT=20
SENDER_FILTER=""
SUBJECT_FILTER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_usage() {
  cat << EOF
Usage: fetch-newsletters.sh [OPTIONS]

Options:
  --dry-run              List newsletters without downloading (default: false)
  --account ACCOUNT      Fetch from specific account (default: all accounts)
  --limit N              Limit results to N emails (default: 20)
  --sender PATTERN       Filter by sender pattern (optional)
  --subject PATTERN      Filter by subject pattern (optional)
  --help                 Show this help message

Examples:
  # List newsletters (dry-run)
  fetch-newsletters.sh --dry-run --limit 10

  # Fetch from specific account
  fetch-newsletters.sh --account gmail --limit 5

  # Filter by sender
  fetch-newsletters.sh --sender "substack" --dry-run

  # Filter by subject
  fetch-newsletters.sh --subject "morning" --dry-run
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --account)
        ACCOUNT="$2"
        shift 2
        ;;
      --limit)
        LIMIT="$2"
        shift 2
        ;;
      --sender)
        SENDER_FILTER="$2"
        shift 2
        ;;
      --subject)
        SUBJECT_FILTER="$2"
        shift 2
        ;;
      --help)
        show_usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1"
        show_usage
        exit 1
        ;;
    esac
  done
}

is_newsletter() {
  local subject="$1"
  local from="$2"
  local lower=$(echo "$subject $from" | tr '[:upper:]' '[:lower:]')
  
  # Check against newsletter patterns
  if echo "$lower" | grep -qE 'newsletter|digest|weekly|daily|pragmatic|substack|morning.brew|뉴스레터|medium|reading'; then
    return 0
  fi
  
  return 1
}

matches_filters() {
  local subject="$1"
  local from="$2"
  local lower=$(echo "$subject $from" | tr '[:upper:]' '[:lower:]')
  
  if [ -n "$SENDER_FILTER" ]; then
    if ! echo "$lower" | grep -qi "$SENDER_FILTER"; then
      return 1
    fi
  fi
  
  if [ -n "$SUBJECT_FILTER" ]; then
    if ! echo "$lower" | grep -qi "$SUBJECT_FILTER"; then
      return 1
    fi
  fi
  
  return 0
}

fetch_newsletters() {
  local account="$1"
  local count="$2"
  
  echo -e "${BLUE}=== Fetching newsletters from $account ===${NC}"
  
  local newsletters=()
  local total=0
  
  # Get emails from account
  local output
  if [ -n "$account" ]; then
    output=$("$MAIL_SCRIPT" listall "$account" "$count" 2>/dev/null || echo "")
  else
    output=$("$MAIL_SCRIPT" listall "" "$count" 2>/dev/null || echo "")
  fi
  
  # Parse output and filter newsletters
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[\|\+\-] ]] || continue
    [[ "$line" =~ ^[\|\s]*ID ]] && continue
    [[ "$line" =~ ^\+------ ]] && continue
    [[ "$line" =~ ^\|------ ]] && continue
    
    local id=$(echo "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}')
    local subject=$(echo "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $4); print $4}')
    local from=$(echo "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $5); print $5}')
    
    [[ -z "$id" || "$id" == "ID" ]] && continue
    
    if is_newsletter "$subject" "$from" && matches_filters "$subject" "$from"; then
      newsletters+=("[$id] $from - $subject")
      ((total++))
    fi
  done < <(echo "$output")
  
  if [ ${#newsletters[@]} -gt 0 ]; then
    echo -e "${GREEN}Found $total newsletter(s)${NC}"
    printf '%s\n' "${newsletters[@]}"
  else
    echo -e "${YELLOW}No newsletters found${NC}"
  fi
  
  echo ""
}

main() {
  parse_args "$@"
  
  if [ ! -f "$MAIL_SCRIPT" ]; then
    echo -e "${RED}Error: mail.sh not found at $MAIL_SCRIPT${NC}"
    exit 1
  fi
  
  if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Warning: Config file not found at $CONFIG_FILE${NC}"
  fi
  
  echo -e "${BLUE}=== Newsletter Fetcher ===${NC}"
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}(DRY RUN - no emails will be downloaded)${NC}"
  fi
  echo ""
  
  if [ -n "$ACCOUNT" ]; then
    fetch_newsletters "$ACCOUNT" "$LIMIT"
  else
    # Fetch from all accounts
    local accounts=$("$MAIL_SCRIPT" accounts 2>/dev/null | tail -n +3 | awk '{print $2}')
    if [ -z "$accounts" ]; then
      echo -e "${RED}No accounts found${NC}"
      exit 1
    fi
    
    for acct in $accounts; do
      fetch_newsletters "$acct" "$LIMIT"
    done
  fi
  
  echo -e "${GREEN}Newsletter fetch complete!${NC}"
}

main "$@"
