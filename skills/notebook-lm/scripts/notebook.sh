#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SKILL_DIR/references/config.json"

load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        AUTH_STATE_PATH=$(jq -r '.auth_state_path // "~/.config/moltbot/notebook-lm-auth.json"' "$CONFIG_FILE")
    else
        AUTH_STATE_PATH="~/.config/moltbot/notebook-lm-auth.json"
    fi

    AUTH_STATE_PATH="${AUTH_STATE_PATH/#\~/$HOME}"
}

show_help() {
    echo "Usage: notebook.sh [command]"
    echo ""
    echo "Commands:"
    echo "  auth    - Run one-time Google auth setup"
    echo "  upload  - Upload a file or text to NotebookLM"
    echo "  help    - Show this help"
    echo ""
    echo "Examples:"
    echo "  ./notebook.sh auth"
    echo "  ./notebook.sh upload --notebook-url=URL --file=PATH"
    echo "  ./notebook.sh upload --notebook-url=URL --text=CONTENT --title=TITLE"
}

case "${1:-help}" in
    auth)
        bun run "$SCRIPT_DIR/auth-setup.ts"
        ;;
    upload)
        load_config
        if [ ! -f "$AUTH_STATE_PATH" ]; then
            echo "Auth state not found at $AUTH_STATE_PATH" >&2
            echo "Run: ./notebook.sh auth" >&2
            exit 1
        fi
        bun run "$SCRIPT_DIR/upload.ts" "${@:2}"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        exit 1
        ;;
esac
