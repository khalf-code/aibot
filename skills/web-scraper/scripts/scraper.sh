#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
    cat <<'EOF'
Usage:
  scraper.sh rss <feed-url>
  scraper.sh web <url> [--selector="article"]
  scraper.sh help
EOF
}

COMMAND="${1:-}"

if [ -z "$COMMAND" ] || [ "$COMMAND" = "help" ]; then
    usage
    exit 0
fi

URL="${2:-}"

case "$COMMAND" in
    rss|web)
        if [ -z "$URL" ]; then
            usage >&2
            exit 1
        fi

        if ! bun run "$SCRIPT_DIR/validate-url.ts" "$URL" >/dev/null; then
            exit 1
        fi

        if [ "$COMMAND" = "rss" ]; then
            bun run "$SCRIPT_DIR/scrape-rss.ts" "$URL"
        else
            shift 2
            bun run "$SCRIPT_DIR/scrape-web.ts" "$URL" "$@"
        fi
        ;;
    *)
        echo "Unknown command: $COMMAND" >&2
        usage >&2
        exit 1
        ;;
esac
