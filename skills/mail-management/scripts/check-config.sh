#!/bin/bash

# check-config.sh - Test himalaya IMAP/SMTP connectivity and configuration
# Usage: check-config.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Himalaya Configuration Check ===${NC}\n"

# Check if himalaya is installed
if ! command -v himalaya &> /dev/null; then
  echo -e "${RED}✗ himalaya CLI not found${NC}"
  echo "  Please install himalaya: https://github.com/soywod/himalaya"
  exit 1
fi

echo -e "${GREEN}✓ himalaya CLI found${NC}"
echo "  Version: $(himalaya --version 2>/dev/null || echo 'unknown')"
echo ""

# Get account list
echo -e "${BLUE}=== Accounts ===${NC}"
if accounts=$(himalaya account list 2>/dev/null); then
  echo "$accounts"
  account_count=$(echo "$accounts" | tail -n +3 | wc -l)
  if [ "$account_count" -gt 0 ]; then
    echo -e "\n${GREEN}✓ Found $account_count account(s)${NC}"
  else
    echo -e "\n${YELLOW}⚠ No accounts configured${NC}"
  fi
else
  echo -e "${RED}✗ Failed to list accounts${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}=== Connectivity Test ===${NC}"

# Test each account
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[\|\+\-] ]] || continue
  [[ "$line" =~ ^[\|\s]*NAME ]] && continue
  [[ "$line" =~ ^\+------ ]] && continue
  [[ "$line" =~ ^\|------ ]] && continue
  
  account=$(echo "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2}')
  [[ -z "$account" || "$account" == "NAME" ]] && continue
  
  echo -n "Testing $account... "
  
  if himalaya envelope list -a "$account" --page-size 1 &>/dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
  fi
done < <(himalaya account list 2>/dev/null)

echo ""
echo -e "${BLUE}=== Configuration Summary ===${NC}"
echo "Himalaya config location: ~/.config/himalaya/"
echo "For more info: himalaya account list"
echo ""
echo -e "${GREEN}Configuration check complete!${NC}"
