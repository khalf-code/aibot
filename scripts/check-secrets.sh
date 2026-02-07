#!/usr/bin/env bash

# Secret scanning script for OpenClaw repository
# Checks staged files for common secret patterns and exits non-zero if found

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_FOUND=0

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "Running secret scanning on staged files..."

# Get list of staged files (exclude deleted files)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
    echo "No staged files to check."
    exit 0
fi

# Define secret patterns as parallel arrays (bash 3 compatible)
PATTERN_NAMES=(
    AWS_KEY
    AWS_SECRET
    PRIVATE_KEY
    GITHUB_TOKEN
    DISCORD_TOKEN
    SLACK_TOKEN
    STRIPE_KEY
    TELEGRAM_TOKEN
    GOOGLE_API_KEY
)
PATTERN_REGEXES=(
    'AKIA[0-9A-Z]{16}'
    'aws_secret_access_key[[:space:]]*=[[:space:]]*[A-Za-z0-9/+=]{40}'
    '-----BEGIN[[:space:]]*(RSA|DSA|EC)?[[:space:]]*PRIVATE[[:space:]]*KEY'
    'ghp_[A-Za-z0-9_]{36}'
    '[MN][A-Za-z0-9_-]{23}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}'
    'xox[baprs]-[0-9]{10,13}-[0-9]{10,13}'
    '(sk|pk)_(test|live)_[A-Za-z0-9]{20,}'
    '[0-9]+:AA[A-Za-z0-9_-]{25,}'
    'AIza[0-9A-Za-z_-]{35}'
)

# Files to skip
SKIP_PATTERNS=(".secrets.baseline" "pnpm-lock.yaml" "yarn.lock" "package-lock.json" ".env.example" ".env.sample")

check_file() {
    local file="$1"
    local file_content

    # Skip excluded files
    for skip in "${SKIP_PATTERNS[@]}"; do
        case "$file" in
            *"$skip"*) return 0 ;;
        esac
    done

    # Skip binary/non-text files
    if ! file "$file" 2>/dev/null | grep -q "text"; then
        return 0
    fi

    # Get the staged content of the file
    file_content=$(git show ":$file" 2>/dev/null || echo "")

    # Check each pattern
    local i=0
    while [ $i -lt ${#PATTERN_NAMES[@]} ]; do
        local pattern_name="${PATTERN_NAMES[$i]}"
        local pattern="${PATTERN_REGEXES[$i]}"
        i=$((i + 1))

        if echo "$file_content" | grep -E "$pattern" > /dev/null 2>&1; then
            # Skip if it's a test/example/placeholder
            if echo "$file_content" | grep -iE "test|example|fake|dummy|placeholder" | grep -E "$pattern" > /dev/null 2>&1; then
                continue
            fi

            echo -e "${RED}[CRITICAL]${NC} Potential secret detected in $file"
            echo -e "${YELLOW}Pattern:${NC} $pattern_name"
            echo -e "${YELLOW}Suggestion:${NC} Review the file and remove any sensitive information before committing"
            echo ""
            SECRETS_FOUND=$((SECRETS_FOUND + 1))
        fi
    done
}

# Check each staged file
for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
        check_file "$file"
    fi
done

if [ $SECRETS_FOUND -gt 0 ]; then
    echo -e "${RED}================================${NC}"
    echo -e "${RED}$SECRETS_FOUND potential secret(s) found!${NC}"
    echo -e "${RED}================================${NC}"
    echo ""
    echo "BLOCKING COMMIT: Remove secrets before committing"
    echo ""
    echo "To unstage files and fix:"
    echo "  git reset HEAD <file>"
    echo "  [edit file to remove secrets]"
    echo "  git add <file>"
    echo ""
    exit 1
fi

echo -e "${GREEN}Secret scan passed - no secrets detected${NC}"
exit 0
