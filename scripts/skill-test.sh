#!/usr/bin/env bash
#
# SK-009 (#35) -- Test harness CLI for individual skills.
#
# Validates that a skill directory exists and has tests, then runs
# them via `pnpm vitest run`.
#
# Usage:
#   ./scripts/skill-test.sh <skill-name>
#
# Example:
#   ./scripts/skill-test.sh enrich-lead-website
#
set -euo pipefail

# --- helpers ----------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

# --- arg parsing ------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-name>"
  echo ""
  echo "Run the vitest suite for a single skill."
  echo ""
  echo "Example:"
  echo "  $0 enrich-lead-website"
  exit 1
fi

SKILL_NAME="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$ROOT_DIR/skills/$SKILL_NAME"
TESTS_DIR="$SKILL_DIR/tests"

# --- validation -------------------------------------------------------------

if [[ ! -d "$SKILL_DIR" ]]; then
  die "Skill directory not found: $SKILL_DIR"
fi

if [[ ! -d "$TESTS_DIR" ]]; then
  die "No tests/ directory found for skill '$SKILL_NAME' (expected $TESTS_DIR)"
fi

# Check that there is at least one test file.
TEST_FILES=$(find "$TESTS_DIR" -maxdepth 2 -type f -name '*.test.ts' -o -name '*.test.js' | head -1)
if [[ -z "$TEST_FILES" ]]; then
  die "No test files (*.test.ts / *.test.js) found in $TESTS_DIR"
fi

# --- run tests --------------------------------------------------------------

echo "Running tests for skill: $SKILL_NAME"
echo "  Directory: $SKILL_DIR"
echo "  Tests:     $TESTS_DIR"
echo ""

cd "$ROOT_DIR"
exec pnpm vitest run "skills/$SKILL_NAME/tests/"
