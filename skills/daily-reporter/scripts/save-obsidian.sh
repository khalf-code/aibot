#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SKILL_DIR/references/config.json"

show_help() {
    cat << 'EOF'
Usage: save-obsidian.sh <input-file>

Copy generated markdown into the Obsidian vault and optionally commit to git.
EOF
}

expand_tilde() {
    local path="$1"
    if [[ "$path" == "~/"* ]]; then
        echo "${HOME}/${path:2}"
    else
        echo "$path"
    fi
}

load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        OBSIDIAN_VAULT=$(jq -r '.obsidian_vault // "~/Dev/BrainFucked"' "$CONFIG_FILE")
        DAILY_FOLDER=$(jq -r '.daily_folder // "95-Daily"' "$CONFIG_FILE")
        FILENAME_FORMAT=$(jq -r '.filename_format // "{date}-daily.md"' "$CONFIG_FILE")
    else
        OBSIDIAN_VAULT="~/Dev/BrainFucked"
        DAILY_FOLDER="95-Daily"
        FILENAME_FORMAT="{date}-daily.md"
    fi
}

resolve_date() {
    local input_name
    input_name=$(basename "$1")
    local found
    found=$(echo "$input_name" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -n1 || true)
    if [ -n "$found" ]; then
        echo "$found"
    else
        date +%Y-%m-%d
    fi
}

backup_if_exists() {
    local target="$1"
    if [ -f "$target" ]; then
        local timestamp
        timestamp=$(date +%Y%m%d-%H%M%S)
        cp "$target" "$target.bak-$timestamp"
    fi
}

git_commit() {
    local vault_dir="$1"
    local relative_path="$2"
    local date_str="$3"
    if [ -d "$vault_dir/.git" ]; then
        git -C "$vault_dir" add "$relative_path" 2>/dev/null || true
        git -C "$vault_dir" commit -m "daily: $date_str" 2>/dev/null || true
    fi
}

if [ "${1:-}" = "" ] || [ "${1:-}" = "--help" ]; then
    show_help
    exit 0
fi

INPUT_FILE="$1"

if [ ! -f "$INPUT_FILE" ]; then
    echo "Input file not found: $INPUT_FILE" >&2
    exit 1
fi

load_config

OBSIDIAN_VAULT=$(expand_tilde "$OBSIDIAN_VAULT")
DAILY_DIR="$OBSIDIAN_VAULT/$DAILY_FOLDER"

mkdir -p "$DAILY_DIR"

DATE_STR=$(resolve_date "$INPUT_FILE")
FILENAME="${FILENAME_FORMAT//\{date\}/$DATE_STR}"
TARGET_PATH="$DAILY_DIR/$FILENAME"
RELATIVE_PATH="$DAILY_FOLDER/$FILENAME"

backup_if_exists "$TARGET_PATH"
cp "$INPUT_FILE" "$TARGET_PATH"

git_commit "$OBSIDIAN_VAULT" "$RELATIVE_PATH" "$DATE_STR"

echo "Saved to: $TARGET_PATH"
