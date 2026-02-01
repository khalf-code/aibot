#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
HIMALAYA_SCRIPT="/Users/koed/moltbot/skills/himalaya/scripts/mail.sh"

MAIL_ID=""
ACCOUNT=""
INPUT_MODE="mail"
OUTPUT_FORMAT="markdown"
STDIN_INPUT=""

show_help() {
    cat << 'EOF'
Usage: digest.sh [OPTIONS] [MAIL_ID]

Create a newsletter digest with HTML sanitization and key point extraction.

OPTIONS:
  --help              Show this help message
  --stdin             Read email body from stdin instead of mail ID
  --json              Output as JSON instead of markdown
  --account ACCOUNT   Specify email account (default: auto-detect)

EXAMPLES:
  digest.sh 50395
  digest.sh 50395 gmail
  digest.sh --stdin < email.html
  digest.sh --stdin --json < email.html
EOF
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            show_help
            exit 0
            ;;
        --stdin)
            INPUT_MODE="stdin"
            shift
            ;;
        --json)
            OUTPUT_FORMAT="json"
            shift
            ;;
        --account)
            ACCOUNT="$2"
            shift 2
            ;;
        -*)
            echo "Unknown option: $1" >&2
            show_help
            exit 1
            ;;
        *)
            MAIL_ID="$1"
            shift
            ;;
    esac
done

if [ "$INPUT_MODE" = "mail" ] && [ -z "$MAIL_ID" ]; then
    echo "Error: MAIL_ID required or use --stdin" >&2
    show_help
    exit 1
fi

if [ "$INPUT_MODE" = "stdin" ]; then
    EMAIL_BODY=$(cat)
else
    if [ -n "$ACCOUNT" ]; then
        EMAIL_BODY=$("$HIMALAYA_SCRIPT" read "$MAIL_ID" "$ACCOUNT")
    else
        EMAIL_BODY=$("$HIMALAYA_SCRIPT" read "$MAIL_ID")
    fi
fi

CLEAN_TEXT=$(echo "$EMAIL_BODY" | python3 "$SCRIPT_DIR/parse-html.py")

if [ "$OUTPUT_FORMAT" = "json" ]; then
    echo "$CLEAN_TEXT" | python3 "$SCRIPT_DIR/summarize.py" --json
else
    echo "$CLEAN_TEXT" | python3 "$SCRIPT_DIR/summarize.py"
fi
