#!/bin/bash

set -euo pipefail

# Script: cleanup-downloads.sh
# Purpose: Organize ~/Downloads by file type
# Usage: cleanup-downloads.sh [--dry-run] [--help]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../references/config.json"

# Default flags
DRY_RUN=false
HELP=false

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
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Show help
if [[ "$HELP" == true ]]; then
  cat << 'EOF'
cleanup-downloads.sh - Organize ~/Downloads by file type

USAGE:
  cleanup-downloads.sh [OPTIONS]

OPTIONS:
  --dry-run    Show what would be moved without making changes
  --help       Show this help message

DESCRIPTION:
  Organizes files in ~/Downloads into subdirectories based on file type.
  File type mappings are defined in references/config.json.

  Creates subdirectories for:
  - documents/
  - images/
  - videos/
  - audio/
  - archives/
  - code/
  - data/
  - other/

EXAMPLES:
  # Preview changes
  cleanup-downloads.sh --dry-run

  # Actually organize files
  cleanup-downloads.sh

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

DOWNLOAD_DIR=$(expand_path "$(jq -r '.download_dir' "$CONFIG_FILE")")
FILE_TYPES=$(jq -r '.file_type_mappings' "$CONFIG_FILE")

# Verify download directory exists
if [[ ! -d "$DOWNLOAD_DIR" ]]; then
  echo "Error: Download directory not found: $DOWNLOAD_DIR" >&2
  exit 1
fi

# Function to get category for a file
get_file_category() {
  local file="$1"
  local ext="${file##*.}"
  ext=$(echo ".${ext}" | tr '[:upper:]' '[:lower:]')
  
  # Check each category
  while IFS= read -r category; do
    local extensions=$(echo "$FILE_TYPES" | jq -r ".\"$category\" | join(\" \")")
    if [[ " $extensions " == *" $ext "* ]]; then
      echo "$category"
      return 0
    fi
  done < <(echo "$FILE_TYPES" | jq -r 'keys[]')
  
  echo "other"
}

# Function to move file
move_file() {
  local file="$1"
  local category="$2"
  local target_dir="$DOWNLOAD_DIR/$category"
  
  # Create target directory if needed
  if [[ ! -d "$target_dir" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      echo "[DRY-RUN] mkdir -p \"$target_dir\""
    else
      mkdir -p "$target_dir"
    fi
  fi
  
  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY-RUN] mv \"$file\" \"$target_dir/\""
  else
    mv "$file" "$target_dir/"
  fi
}

# Main cleanup logic
echo "Organizing files in: $DOWNLOAD_DIR"
if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN MODE] No files will be moved"
fi
echo ""

moved_count=0
skipped_count=0

# Process files in download directory (non-recursive, top level only)
while IFS= read -r -d '' file; do
  filename=$(basename "$file")
  
  # Skip hidden files and directories
  if [[ "$filename" == .* ]]; then
    ((skipped_count++))
    continue
  fi
  
  # Skip if it's a directory
  if [[ -d "$file" ]]; then
    continue
  fi
  
  # Get category and move
  category=$(get_file_category "$filename")
  echo "Moving: $filename → $category/"
  move_file "$file" "$category"
  ((moved_count++))
done < <(find "$DOWNLOAD_DIR" -maxdepth 1 -type f -print0)

echo ""
echo "Summary:"
echo "  Moved: $moved_count files"
echo "  Skipped: $skipped_count files"

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "Run without --dry-run to apply changes"
fi
