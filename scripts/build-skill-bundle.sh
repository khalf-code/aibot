#!/usr/bin/env bash
set -euo pipefail

# Build a distributable skill bundle (.tar.gz) with metadata.
# Usage: ./scripts/build-skill-bundle.sh <skill-name>
# Example: ./scripts/build-skill-bundle.sh enrich-lead-website
#
# Outputs:
#   dist/skills/<skill-name>-<version>.tar.gz
#   dist/skills/<skill-name>-<version>.bundle-metadata.json

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$ROOT_DIR/skills"
OUTPUT_DIR="$ROOT_DIR/dist/skills"

# --- helpers ----------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not found in PATH"
}

# Extract a YAML value from a simple key: value line (no nested objects).
# Works for manifest.yaml flat keys. Not a full YAML parser.
yaml_value() {
  local file="$1" key="$2"
  sed -n "s/^${key}:[[:space:]]*//p" "$file" | sed 's/^["'"'"']\(.*\)["'"'"']$/\1/' | head -1
}

# Extract frontmatter from SKILL.md and pull a key from it.
frontmatter_value() {
  local file="$1" key="$2"
  # Extract YAML between leading --- fences
  local fm
  fm=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$file")
  echo "$fm" | sed -n "s/^${key}:[[:space:]]*//p" | sed 's/^["'"'"']\(.*\)["'"'"']$/\1/' | head -1
}

# --- arg parsing ------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-name>"
  echo "  Builds a tarball bundle for the given skill."
  echo ""
  echo "Example:"
  echo "  $0 enrich-lead-website"
  exit 1
fi

SKILL_NAME="$1"
SKILL_DIR="$SKILLS_DIR/$SKILL_NAME"

[[ -d "$SKILL_DIR" ]] || die "Skill directory not found: $SKILL_DIR"

# --- read manifest ----------------------------------------------------------

MANIFEST_FILE="$SKILL_DIR/manifest.yaml"
SKILL_MD_FILE="$SKILL_DIR/SKILL.md"

NAME=""
VERSION=""

if [[ -f "$MANIFEST_FILE" ]]; then
  NAME=$(yaml_value "$MANIFEST_FILE" "name")
  VERSION=$(yaml_value "$MANIFEST_FILE" "version")
elif [[ -f "$SKILL_MD_FILE" ]]; then
  NAME=$(frontmatter_value "$SKILL_MD_FILE" "name")
  VERSION=$(frontmatter_value "$SKILL_MD_FILE" "version")
else
  die "No manifest.yaml or SKILL.md found in $SKILL_DIR"
fi

# Fall back to directory name / default version if not specified
NAME="${NAME:-$SKILL_NAME}"
VERSION="${VERSION:-0.0.0}"

echo "Skill:   $NAME"
echo "Version: $VERSION"

# --- collect files ----------------------------------------------------------

require_cmd tar
require_cmd shasum

# Build file list (exclude hidden files and common junk)
FILE_LIST=$(cd "$SKILLS_DIR" && find "$SKILL_NAME" -type f \
  ! -name '.*' \
  ! -name '*.pyc' \
  ! -path '*/__pycache__/*' \
  ! -path '*/.git/*' \
  ! -path '*/node_modules/*' \
  | sort)

FILE_COUNT=$(echo "$FILE_LIST" | wc -l | tr -d ' ')
echo "Files:   $FILE_COUNT"

# --- create tarball ---------------------------------------------------------

mkdir -p "$OUTPUT_DIR"

BUNDLE_FILENAME="${NAME}-${VERSION}.tar.gz"
BUNDLE_PATH="$OUTPUT_DIR/$BUNDLE_FILENAME"
METADATA_PATH="$OUTPUT_DIR/${NAME}-${VERSION}.bundle-metadata.json"

# Create the tarball from the skills/ parent so paths are skills/<name>/...
tar -czf "$BUNDLE_PATH" -C "$SKILLS_DIR" $FILE_LIST

BUNDLE_SIZE=$(wc -c < "$BUNDLE_PATH" | tr -d ' ')
SHA256=$(shasum -a 256 "$BUNDLE_PATH" | cut -d ' ' -f1)
BUILD_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Bundle:  $BUNDLE_PATH ($BUNDLE_SIZE bytes)"
echo "SHA256:  $SHA256"

# --- generate metadata ------------------------------------------------------

# Build JSON files array
FILES_JSON="["
FIRST=true
while IFS= read -r f; do
  if $FIRST; then FIRST=false; else FILES_JSON+=","; fi
  FILES_JSON+="\"$f\""
done <<< "$FILE_LIST"
FILES_JSON+="]"

cat > "$METADATA_PATH" <<ENDJSON
{
  "name": "$NAME",
  "version": "$VERSION",
  "sha256": "$SHA256",
  "build_timestamp": "$BUILD_TS",
  "bundle_filename": "$BUNDLE_FILENAME",
  "bundle_size_bytes": $BUNDLE_SIZE,
  "files": $FILES_JSON
}
ENDJSON

echo "Meta:    $METADATA_PATH"

# --- summary ----------------------------------------------------------------

echo ""
echo "--- Bundle Summary ---"
echo "  Name:      $NAME"
echo "  Version:   $VERSION"
echo "  SHA256:    $SHA256"
echo "  Size:      $BUNDLE_SIZE bytes"
echo "  Files:     $FILE_COUNT"
echo "  Timestamp: $BUILD_TS"
echo "  Bundle:    $BUNDLE_PATH"
echo "  Metadata:  $METADATA_PATH"
echo "--- Done ---"
