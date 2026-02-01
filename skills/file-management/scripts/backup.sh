#!/bin/bash

set -euo pipefail

# Script: backup.sh
# Purpose: Backup folders to external storage
# Usage: backup.sh [--dry-run] [--help] [--target DIR]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../references/config.json"

# Default flags
DRY_RUN=false
HELP=false
CUSTOM_TARGET=""

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
    --target)
      CUSTOM_TARGET="$2"
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
backup.sh - Backup folders to external storage

USAGE:
  backup.sh [OPTIONS]

OPTIONS:
  --dry-run       Show what would be backed up without making changes
  --target DIR    Override backup target directory from config
  --help          Show this help message

DESCRIPTION:
  Backs up important directories to external storage.
  Backup target is defined in references/config.json.

  Backs up:
  - ~/Documents
  - ~/Desktop
  - ~/.config
  - ~/.ssh (if exists)
  - ~/moltbot (if exists)

EXAMPLES:
  # Preview backup
  backup.sh --dry-run

  # Backup to custom location
  backup.sh --target /Volumes/MyDrive/backups

  # Actually perform backup
  backup.sh

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

BACKUP_TARGET=$(expand_path "${CUSTOM_TARGET:-$(jq -r '.backup_target' "$CONFIG_FILE")}")

# Verify backup target exists or can be created
if [[ ! -d "$BACKUP_TARGET" ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY-RUN] mkdir -p \"$BACKUP_TARGET\""
  else
    mkdir -p "$BACKUP_TARGET" || {
      echo "Error: Cannot create backup target: $BACKUP_TARGET" >&2
      exit 1
    }
  fi
fi

# Define folders to backup
BACKUP_FOLDERS=(
  "~/Documents"
  "~/Desktop"
  "~/.config"
  "~/.ssh"
  "~/moltbot"
)

# Function to backup a folder
backup_folder() {
  local source="$1"
  local target="$2"
  local source_expanded=$(expand_path "$source")
  
  # Skip if source doesn't exist
  if [[ ! -d "$source_expanded" ]]; then
    echo "Skipping (not found): $source"
    return 0
  fi
  
  local folder_name=$(basename "$source_expanded")
  local backup_path="$target/$folder_name"
  
  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY-RUN] rsync -av --delete \"$source_expanded/\" \"$backup_path/\""
  else
    echo "Backing up: $source → $backup_path"
    rsync -av --delete "$source_expanded/" "$backup_path/" || {
      echo "Warning: Backup of $source had errors" >&2
    }
  fi
}

# Main backup logic
echo "Backing up to: $BACKUP_TARGET"
if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN MODE] No files will be copied"
fi
echo ""

backed_up=0
skipped=0

for folder in "${BACKUP_FOLDERS[@]}"; do
  source_expanded=$(expand_path "$folder")
  if [[ -d "$source_expanded" ]]; then
    backup_folder "$folder" "$BACKUP_TARGET"
    ((backed_up++))
  else
    echo "Skipping (not found): $folder"
    ((skipped++))
  fi
done

echo ""
echo "Summary:"
echo "  Backed up: $backed_up folders"
echo "  Skipped: $skipped folders"

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "Run without --dry-run to apply changes"
fi
