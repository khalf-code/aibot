#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

show_help() {
    cat << 'EOF'
Usage: reporter.sh [command]

Commands:
  generate  - Generate daily report and save to Obsidian (default)
  preview   - Preview report without saving
  save      - Save an existing markdown file to Obsidian
  help      - Show this help message
EOF
}

generate_document() {
    local output_file="$TMP_DIR/daily-report.md"
    bun run "$SCRIPT_DIR/generate-daily.ts" --output "$output_file"
    echo "$output_file"
}

save_document() {
    local input_file="$1"
    "$SCRIPT_DIR/save-obsidian.sh" "$input_file"
}

case "${1:-generate}" in
    generate)
        GENERATED_FILE=$(generate_document)
        save_document "$GENERATED_FILE"
        ;;
    preview)
        bun run "$SCRIPT_DIR/generate-daily.ts"
        ;;
    save)
        if [ -z "${2:-}" ]; then
            echo "Usage: reporter.sh save <input-file>" >&2
            exit 1
        fi
        save_document "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        exit 1
        ;;
esac
