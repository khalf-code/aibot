#!/usr/bin/env bash
#
# discover-skills.sh — Walk skills/ and validate manifest.yaml files.
#
# Finds all subdirectories of skills/ that contain a manifest.yaml,
# validates required fields (name, version, description), and prints
# a summary table. Exits non-zero if any manifest is invalid.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"

if [ ! -d "$SKILLS_DIR" ]; then
  printf 'Error: skills directory not found at %s\n' "$SKILLS_DIR" >&2
  exit 1
fi

# Collect results
declare -a valid_names=()
declare -a valid_versions=()
declare -a valid_descriptions=()
declare -a errors=()

# Find all manifest.yaml files under skills/
while IFS= read -r manifest; do
  skill_dir="$(dirname "$manifest")"
  skill_slug="$(basename "$skill_dir")"

  # Extract required fields using simple grep/sed (no yaml parser dependency).
  # Handles both quoted and unquoted values.
  extract_field() {
    local field="$1"
    local file="$2"
    # Match top-level field (no leading whitespace), strip quotes
    value=$(grep -m1 "^${field}:" "$file" 2>/dev/null | sed "s/^${field}:[[:space:]]*//" | sed 's/^["'\'']//' | sed 's/["'\''][[:space:]]*$//' | sed 's/[[:space:]]*$//')
    printf '%s' "$value"
  }

  name=$(extract_field "name" "$manifest")
  version=$(extract_field "version" "$manifest")
  description=$(extract_field "description" "$manifest")

  has_error=false

  if [ -z "$name" ]; then
    errors+=("  $skill_slug: missing required field 'name'")
    has_error=true
  fi

  if [ -z "$version" ]; then
    errors+=("  $skill_slug: missing required field 'version'")
    has_error=true
  fi

  if [ -z "$description" ]; then
    errors+=("  $skill_slug: missing required field 'description'")
    has_error=true
  fi

  if [ "$has_error" = false ]; then
    valid_names+=("$name")
    valid_versions+=("$version")
    valid_descriptions+=("$description")
  fi

done < <(find "$SKILLS_DIR" -mindepth 2 -maxdepth 2 -name "manifest.yaml" -type f | sort)

total=$(( ${#valid_names[@]} + ${#errors[@]} ))

if [ "$total" -eq 0 ]; then
  printf 'No skills with manifest.yaml found in %s\n' "$SKILLS_DIR"
  exit 0
fi

# Print summary table
printf '\n'
printf '%-30s %-12s %s\n' "SKILL" "VERSION" "DESCRIPTION"
printf '%-30s %-12s %s\n' "-----" "-------" "-----------"

for i in "${!valid_names[@]}"; do
  # Truncate description to 60 chars for table display
  desc="${valid_descriptions[$i]}"
  if [ "${#desc}" -gt 60 ]; then
    desc="${desc:0:57}..."
  fi
  printf '%-30s %-12s %s\n' "${valid_names[$i]}" "${valid_versions[$i]}" "$desc"
done

printf '\n'
printf 'Discovered: %d skill(s)\n' "${#valid_names[@]}"

# Report errors
if [ "${#errors[@]}" -gt 0 ]; then
  printf '\nValidation errors:\n' >&2
  for err in "${errors[@]}"; do
    printf '%s\n' "$err" >&2
  done
  printf '\nFailed: %d manifest(s) invalid\n' "${#errors[@]}" >&2
  exit 1
fi

printf 'All manifests valid.\n'
