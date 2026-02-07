#!/usr/bin/env bash
set -euo pipefail

# Verify a skill bundle tarball against its metadata.
# Usage: ./scripts/verify-skill-bundle.sh <bundle-path>
# Example: ./scripts/verify-skill-bundle.sh dist/skills/enrich-lead-website-1.0.0.tar.gz
#
# Checks:
#   1. Bundle file exists and is a valid gzip tarball
#   2. Companion bundle-metadata.json exists
#   3. SHA256 hash matches the recorded value
#   4. Bundle contains a manifest (manifest.yaml or SKILL.md)
#   5. Manifest has required fields (name, description)

# --- helpers ----------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

FAILURES=0

# --- arg parsing ------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <bundle-path>"
  echo "  Verify a .tar.gz skill bundle and its metadata."
  echo ""
  echo "Example:"
  echo "  $0 dist/skills/enrich-lead-website-1.0.0.tar.gz"
  exit 1
fi

BUNDLE_PATH="$1"

# --- basic checks -----------------------------------------------------------

[[ -f "$BUNDLE_PATH" ]] || die "Bundle file not found: $BUNDLE_PATH"

# Derive metadata path from bundle path
# e.g. dist/skills/foo-1.0.0.tar.gz -> dist/skills/foo-1.0.0.bundle-metadata.json
METADATA_PATH="${BUNDLE_PATH%.tar.gz}.bundle-metadata.json"

echo "Verifying: $BUNDLE_PATH"
echo ""

# 1. Valid gzip
if file "$BUNDLE_PATH" | grep -q 'gzip'; then
  pass "Bundle is a valid gzip archive"
else
  fail "Bundle is not a valid gzip archive"
fi

# 2. Metadata exists
if [[ -f "$METADATA_PATH" ]]; then
  pass "Metadata file found: $METADATA_PATH"
else
  fail "Metadata file not found: $METADATA_PATH"
  echo ""
  echo -e "${RED}=== VERIFICATION FAILED ===${NC}"
  echo "Cannot continue without metadata file."
  exit 1
fi

# --- SHA256 verification ----------------------------------------------------

RECORDED_SHA256=""
if command -v python3 >/dev/null 2>&1; then
  RECORDED_SHA256=$(python3 -c "
import json, sys
with open('$METADATA_PATH') as f:
    print(json.load(f).get('sha256', ''))
" 2>/dev/null || true)
elif command -v node >/dev/null 2>&1; then
  RECORDED_SHA256=$(node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$METADATA_PATH', 'utf8'));
process.stdout.write(data.sha256 || '');
" 2>/dev/null || true)
fi

if [[ -z "$RECORDED_SHA256" ]]; then
  fail "Could not read sha256 from metadata"
else
  ACTUAL_SHA256=$(shasum -a 256 "$BUNDLE_PATH" | cut -d ' ' -f1)
  if [[ "$ACTUAL_SHA256" == "$RECORDED_SHA256" ]]; then
    pass "SHA256 hash matches: $ACTUAL_SHA256"
  else
    fail "SHA256 mismatch!"
    echo "       Recorded: $RECORDED_SHA256"
    echo "       Actual:   $ACTUAL_SHA256"
  fi
fi

# --- manifest validation inside bundle -------------------------------------

TMPDIR_VERIFY=$(mktemp -d)
trap 'rm -rf "$TMPDIR_VERIFY"' EXIT

tar -xzf "$BUNDLE_PATH" -C "$TMPDIR_VERIFY" 2>/dev/null

# Look for manifest.yaml or SKILL.md in extracted contents
MANIFEST_FOUND=""
MANIFEST_FILE=""

# Search for manifest.yaml
MANIFEST_FILE=$(find "$TMPDIR_VERIFY" -name "manifest.yaml" -type f | head -1)
if [[ -n "$MANIFEST_FILE" ]]; then
  MANIFEST_FOUND="manifest.yaml"
fi

# Search for SKILL.md if no manifest.yaml
if [[ -z "$MANIFEST_FOUND" ]]; then
  MANIFEST_FILE=$(find "$TMPDIR_VERIFY" -name "SKILL.md" -type f | head -1)
  if [[ -n "$MANIFEST_FILE" ]]; then
    MANIFEST_FOUND="SKILL.md"
  fi
fi

if [[ -n "$MANIFEST_FOUND" ]]; then
  pass "Manifest found in bundle: $MANIFEST_FOUND"
else
  fail "No manifest.yaml or SKILL.md found inside bundle"
fi

# Validate required fields if we found a manifest
if [[ -n "$MANIFEST_FILE" ]]; then
  HAS_NAME=false
  HAS_DESC=false

  if [[ "$MANIFEST_FOUND" == "manifest.yaml" ]]; then
    grep -q '^name:' "$MANIFEST_FILE" && HAS_NAME=true
    grep -q '^description:' "$MANIFEST_FILE" && HAS_DESC=true
  elif [[ "$MANIFEST_FOUND" == "SKILL.md" ]]; then
    # Extract frontmatter and check
    FM=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$MANIFEST_FILE")
    echo "$FM" | grep -q '^name:' && HAS_NAME=true
    echo "$FM" | grep -q '^description:' && HAS_DESC=true
  fi

  if $HAS_NAME; then
    pass "Manifest contains 'name' field"
  else
    fail "Manifest missing 'name' field"
  fi

  if $HAS_DESC; then
    pass "Manifest contains 'description' field"
  else
    fail "Manifest missing 'description' field"
  fi
fi

# --- result -----------------------------------------------------------------

echo ""
if [[ $FAILURES -eq 0 ]]; then
  echo -e "${GREEN}=== VERIFICATION PASSED ===${NC}"
  exit 0
else
  echo -e "${RED}=== VERIFICATION FAILED ($FAILURES issue(s)) ===${NC}"
  exit 1
fi
