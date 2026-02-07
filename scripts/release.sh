#!/usr/bin/env bash
#
# release.sh -- Tag a new Clawdbot release.
#
# Usage:
#   ./scripts/release.sh <version>
#
# Example:
#   ./scripts/release.sh 0.1.0
#
# The script will:
#   1. Validate the version string (semver: MAJOR.MINOR.PATCH with optional pre-release).
#   2. Ensure the working tree is clean.
#   3. Update the VERSION file.
#   4. Generate / update CLAWDBOT_CHANGELOG.md from conventional-commit history.
#   5. Commit the VERSION + CLAWDBOT_CHANGELOG.md changes.
#   6. Create an annotated git tag (v<version>).
#   7. Print instructions for pushing the tag.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

usage() {
  cat <<EOF
Usage: $(basename "$0") <version>

  version   Semantic version string (e.g. 0.1.0, 1.2.3-beta.1)

Examples:
  $(basename "$0") 0.1.0
  $(basename "$0") 1.0.0-rc.1
EOF
  exit 2
}

die() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

# Validate semver: MAJOR.MINOR.PATCH with optional pre-release and build metadata.
# Accepts: 0.1.0, 1.0.0-alpha, 1.0.0-beta.1, 1.0.0-rc.1+build.123
validate_semver() {
  local version=$1
  local semver_regex='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?(\+([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?$'
  if [[ ! "$version" =~ $semver_regex ]]; then
    die "Invalid semver format: '$version'. Expected MAJOR.MINOR.PATCH[-prerelease][+build]."
  fi
}

# ---------------------------------------------------------------------------
# Changelog generation
# ---------------------------------------------------------------------------

# Determine the git ref range for changelog entries.
# If a previous tag exists, use <prev_tag>..HEAD; otherwise use all history.
changelog_range() {
  local current_tag="v$1"
  # Find the most recent tag that is NOT the one we are about to create.
  local prev_tag
  prev_tag=$(git tag --sort=-v:refname | grep -v "^${current_tag}$" | head -n 1 || true)
  if [[ -n "$prev_tag" ]]; then
    echo "${prev_tag}..HEAD"
  else
    echo ""
  fi
}

# Collect commits in conventional-commit categories.
generate_changelog_section() {
  local version=$1
  local range=$2
  local date
  date=$(date +%Y-%m-%d)

  local log_cmd="git log --no-merges --pretty=format:%s"
  if [[ -n "$range" ]]; then
    log_cmd="$log_cmd $range"
  fi

  # Collect raw subjects
  local subjects
  subjects=$(eval "$log_cmd" 2>/dev/null || true)

  if [[ -z "$subjects" ]]; then
    # No commits found; produce a minimal section.
    printf '## %s (%s)\n\n_No conventional commits found since last release._\n' "$version" "$date"
    return
  fi

  # Categorise
  local feats="" fixes="" docs="" chores="" refactors="" tests="" perfs="" others=""

  while IFS= read -r line; do
    case "$line" in
      feat:*|feat\(*) feats+="- ${line}
" ;;
      fix:*|fix\(*) fixes+="- ${line}
" ;;
      docs:*|docs\(*) docs+="- ${line}
" ;;
      chore:*|chore\(*) chores+="- ${line}
" ;;
      refactor:*|refactor\(*) refactors+="- ${line}
" ;;
      test:*|test\(*|tests:*|tests\(*) tests+="- ${line}
" ;;
      perf:*|perf\(*) perfs+="- ${line}
" ;;
      ci:*|ci\(*|build:*|build\(*) chores+="- ${line}
" ;;
      *) others+="- ${line}
" ;;
    esac
  done <<< "$subjects"

  # Build section
  printf '## %s (%s)\n' "$version" "$date"

  if [[ -n "$feats" ]]; then
    printf '\n### Added\n\n%s' "$feats"
  fi
  if [[ -n "$fixes" ]]; then
    printf '\n### Fixed\n\n%s' "$fixes"
  fi
  if [[ -n "$docs" ]]; then
    printf '\n### Documentation\n\n%s' "$docs"
  fi
  if [[ -n "$refactors" ]]; then
    printf '\n### Refactored\n\n%s' "$refactors"
  fi
  if [[ -n "$perfs" ]]; then
    printf '\n### Performance\n\n%s' "$perfs"
  fi
  if [[ -n "$tests" ]]; then
    printf '\n### Tests\n\n%s' "$tests"
  fi
  if [[ -n "$chores" ]]; then
    printf '\n### Chores\n\n%s' "$chores"
  fi
  if [[ -n "$others" ]]; then
    printf '\n### Other\n\n%s' "$others"
  fi
}

# Prepend the new version section to CLAWDBOT_CHANGELOG.md.
update_changelog() {
  local version=$1
  local changelog="$REPO_ROOT/CLAWDBOT_CHANGELOG.md"

  local range
  range=$(changelog_range "$version")

  local new_section
  new_section=$(generate_changelog_section "$version" "$range")

  if [[ ! -f "$changelog" ]]; then
    # Create fresh changelog
    cat > "$changelog" <<HEREDOC
# Clawdbot Changelog

All notable changes to the Clawdbot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

${new_section}
HEREDOC
    return
  fi

  # Insert new section after the header block (first blank line after preamble).
  # Strategy: find the line "and this project adheres to" and insert after the
  # next blank line. If that marker is missing, insert after line 1.
  local tmp
  tmp=$(mktemp)

  local inserted=false
  local past_preamble=false

  while IFS= read -r line; do
    echo "$line" >> "$tmp"

    if [[ "$past_preamble" == false ]]; then
      if [[ "$line" == *"Semantic Versioning"* ]]; then
        past_preamble=true
      fi
    elif [[ "$inserted" == false && -z "$line" ]]; then
      # Insert new section here
      printf '\n%s\n' "$new_section" >> "$tmp"
      inserted=true
    fi
  done < "$changelog"

  # If we never found the insertion point, prepend after line 1
  if [[ "$inserted" == false ]]; then
    {
      head -n 1 "$changelog"
      printf '\n%s\n' "$new_section"
      tail -n +2 "$changelog"
    } > "$tmp"
  fi

  mv "$tmp" "$changelog"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  usage
fi

VERSION=$1

validate_semver "$VERSION"

TAG="v${VERSION}"

cd "$REPO_ROOT"

# Guard: tag must not already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  die "Tag '$TAG' already exists. Bump the version or delete the tag first."
fi

# Guard: working tree should be clean (allow untracked files)
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "Working tree has uncommitted changes. Commit or stash them first."
fi

# 1. Update VERSION file
printf '%s\n' "$VERSION" > "$REPO_ROOT/VERSION"
echo "Updated VERSION to $VERSION"

# 2. Generate / update CLAWDBOT_CHANGELOG.md
update_changelog "$VERSION"
echo "Updated CLAWDBOT_CHANGELOG.md"

# 3. Commit the release metadata
git add "$REPO_ROOT/VERSION" "$REPO_ROOT/CLAWDBOT_CHANGELOG.md"
git commit -m "chore(release): $VERSION"
echo "Committed release metadata."

# 4. Create annotated tag
git tag -a "$TAG" -m "Release $VERSION"
echo "Created tag: $TAG"

# 5. Print next steps
cat <<EOF

--------------------------------------------------------------
Release $VERSION tagged successfully.

Next steps:
  1. Push the commit and tag to the remote:

       git push origin main
       git push origin $TAG

  2. (Optional) Create a GitHub release:

       gh release create $TAG --generate-notes

--------------------------------------------------------------
EOF
