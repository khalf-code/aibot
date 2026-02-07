#!/usr/bin/env bash
#
# SK-010 (#36) -- Template generator for new skills.
#
# Copies skills/_template/ to skills/<name>/ and replaces placeholder
# values in manifest.yaml, README.md, and test files so the new skill
# is ready for development immediately.
#
# Usage:
#   ./scripts/new-skill.sh <skill-name>
#
# Example:
#   ./scripts/new-skill.sh check-dns
#
set -euo pipefail

# --- helpers ----------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

# --- arg parsing ------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-name>"
  echo ""
  echo "Create a new skill from the template."
  echo "The name must be lowercase letters, digits, and hyphens only."
  echo ""
  echo "Example:"
  echo "  $0 check-dns"
  exit 1
fi

SKILL_NAME="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/skills/_template"
SKILL_DIR="$ROOT_DIR/skills/$SKILL_NAME"

# --- validation -------------------------------------------------------------

# Name pattern: lowercase letters, digits, and hyphens.
if [[ ! "$SKILL_NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  die "Invalid skill name '$SKILL_NAME'. Use lowercase letters, digits, and hyphens only (e.g. 'check-dns')."
fi

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  die "Template directory not found: $TEMPLATE_DIR"
fi

if [[ -d "$SKILL_DIR" ]]; then
  die "Skill directory already exists: $SKILL_DIR"
fi

# --- copy template ----------------------------------------------------------

echo "Creating new skill: $SKILL_NAME"
echo "  Template: $TEMPLATE_DIR"
echo "  Target:   $SKILL_DIR"
echo ""

cp -r "$TEMPLATE_DIR" "$SKILL_DIR"

# --- replace placeholders ---------------------------------------------------

# Replace "my-skill" with the new skill name in manifest.yaml.
if [[ -f "$SKILL_DIR/manifest.yaml" ]]; then
  sed -i.bak "s/^name: my-skill$/name: $SKILL_NAME/" "$SKILL_DIR/manifest.yaml"
  # Replace the TODO description placeholder with a prompt.
  sed -i.bak "s/TODO: Describe what this skill does in one sentence\./TODO: Describe $SKILL_NAME in one sentence./" "$SKILL_DIR/manifest.yaml"
  rm -f "$SKILL_DIR/manifest.yaml.bak"
fi

# Replace "my-skill" references in README.md.
if [[ -f "$SKILL_DIR/README.md" ]]; then
  sed -i.bak "s/# my-skill/# $SKILL_NAME/" "$SKILL_DIR/README.md"
  sed -i.bak "s/my-skill/$SKILL_NAME/g" "$SKILL_DIR/README.md"
  rm -f "$SKILL_DIR/README.md.bak"
fi

# Replace "my-skill" in test files.
if [[ -f "$SKILL_DIR/tests/index.test.ts" ]]; then
  sed -i.bak "s/describe(\"my-skill\"/describe(\"$SKILL_NAME\"/" "$SKILL_DIR/tests/index.test.ts"
  rm -f "$SKILL_DIR/tests/index.test.ts.bak"
fi

# --- summary ----------------------------------------------------------------

echo "Skill '$SKILL_NAME' created successfully."
echo ""
echo "Next steps:"
echo "  1. Edit skills/$SKILL_NAME/manifest.yaml  -- set description and permissions"
echo "  2. Edit skills/$SKILL_NAME/src/index.ts    -- implement your skill logic"
echo "  3. Edit skills/$SKILL_NAME/fixtures/       -- add realistic test data"
echo "  4. Run tests: ./scripts/skill-test.sh $SKILL_NAME"
echo ""
