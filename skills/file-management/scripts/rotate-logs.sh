#!/bin/bash

set -euo pipefail

# Script: rotate-logs.sh
# Purpose: Compress/delete old log files
# Usage: rotate-logs.sh [--dry-run] [--help] [--days N]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../references/config.json"

# Default flags
DRY_RUN=false
HELP=false
CUSTOM_DAYS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      HELP=true
      shift
      ;;
    --days)
      CUSTOM_DAYS="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Show help
if [[ "$HELP" == true ]]; then
  cat << 'EOF'
rotate-logs.sh - Compress and delete old log files

USAGE:
  rotate-logs.sh [OPTIONS]

OPTIONS:
  --dry-run    Show what would be compressed/deleted without making changes
  --days N     Override retention days from config (default: 30)
  --help       Show this help message

DESCRIPTION:
  Compresses log files older than the retention period and deletes
  very old compressed logs. Helps manage disk space used by logs.

  Actions:
  - Compresses .log files older than retention days to .log.gz
  - Deletes .log.gz files older than 2x retention days
  - Processes directories from references/config.json

EXAMPLES:
  # Preview log rotation
  rotate-logs.sh --dry-run

  # Keep logs for 60 days instead of default 30
  rotate-logs.sh --days 60

  # Actually perform rotation
  rotate-logs.sh

EOF
  exit 0
fi

# Load config
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

# Expand ~ in paths
expand_path() {
  local path="$1"
  echo "${path/#\~/$HOME}"
}

RETENTION_DAYS="${CUSTOM_DAYS:-$(jq -r '.retention_days' "$CONFIG_FILE")}"
LOG_DIRS=$(jq -r '.log_dirs[]' "$CONFIG_FILE")

# Validate retention days
if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "Error: retention_days must be a number, got: $RETENTION_DAYS" >&2
  exit 1
fi

# Function to compress old logs
compress_old_logs() {
  local log_dir="$1"
  local days="$2"
  local log_dir_expanded=$(expand_path "$log_dir")
  
  # Skip if directory doesn't exist
  if [[ ! -d "$log_dir_expanded" ]]; then
    echo "Skipping (not found): $log_dir"
    return 0
  fi
  
  local compressed_count=0
  
  # Find .log files older than retention days
  while IFS= read -r -d '' logfile; do
    if [[ "$DRY_RUN" == true ]]; then
      echo "[DRY-RUN] gzip \"$logfile\""
    else
      gzip "$logfile"
      echo "Compressed: $(basename "$logfile")"
    fi
    ((compressed_count++))
  done < <(find "$log_dir_expanded" -maxdepth 2 -name "*.log" -type f -mtime "+$days" -print0 2>/dev/null || true)
  
  echo "  Compressed: $compressed_count files in $log_dir"
}

# Function to delete very old compressed logs
delete_old_compressed() {
  local log_dir="$1"
  local days="$2"
  local delete_days=$((days * 2))
  local log_dir_expanded=$(expand_path "$log_dir")
  
  # Skip if directory doesn't exist
  if [[ ! -d "$log_dir_expanded" ]]; then
    return 0
  fi
  
  local deleted_count=0
  
  # Find .log.gz files older than 2x retention days
  while IFS= read -r -d '' logfile; do
    if [[ "$DRY_RUN" == true ]]; then
      echo "[DRY-RUN] rm \"$logfile\""
    else
      rm "$logfile"
      echo "Deleted: $(basename "$logfile")"
    fi
    ((deleted_count++))
  done < <(find "$log_dir_expanded" -maxdepth 2 -name "*.log.gz" -type f -mtime "+$delete_days" -print0 2>/dev/null || true)
  
  if [[ $deleted_count -gt 0 ]]; then
    echo "  Deleted: $deleted_count files in $log_dir"
  fi
}

# Main rotation logic
echo "Rotating logs with retention: $RETENTION_DAYS days"
if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN MODE] No files will be modified"
fi
echo ""

total_compressed=0
total_deleted=0

while IFS= read -r log_dir; do
  echo "Processing: $log_dir"
  compress_old_logs "$log_dir" "$RETENTION_DAYS"
  delete_old_compressed "$log_dir" "$RETENTION_DAYS"
done <<< "$LOG_DIRS"

echo ""
echo "Summary:"
echo "  Retention period: $RETENTION_DAYS days"
echo "  Deletion period: $((RETENTION_DAYS * 2)) days"

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "Run without --dry-run to apply changes"
fi
