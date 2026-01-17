#!/usr/bin/env bash
# Rebase hotfix/* branches onto a target release to prevent cherry-pick conflicts
# Usage: ./scripts/rebase-hotfixes.sh [target] [--dry-run] [--force]
#
# Examples:
#   ./scripts/rebase-hotfixes.sh v2026.1.15         # Rebase onto specific version
#   ./scripts/rebase-hotfixes.sh --dry-run          # Preview what would happen
#   ./scripts/rebase-hotfixes.sh v2026.1.15 --force # Skip confirmation prompts

set -euo pipefail

HOTFIX_PREFIX="hotfix/"
TARGET=""
DRY_RUN=false
FORCE=false

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    --force|-f)
      FORCE=true
      ;;
    -*)
      echo "Unknown option: $arg"
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then
        TARGET="$arg"
      else
        echo "Multiple targets specified: $TARGET and $arg"
        exit 1
      fi
      ;;
  esac
done

# If no target specified, use latest tag
if [[ -z "$TARGET" ]]; then
  TARGET=$(git tag --list 'v*' --sort=-version:refname | head -1)
  if [[ -z "$TARGET" ]]; then
    echo "❌ No target specified and no version tags found"
    exit 1
  fi
  echo "📌 No target specified, using latest tag: $TARGET"
  echo ""
fi

# Verify target exists
if ! git rev-parse --verify --quiet "$TARGET" >/dev/null; then
  echo "❌ Target '$TARGET' does not exist"
  exit 1
fi

TARGET_SHA=$(git rev-parse "$TARGET")
TARGET_DESC=$(git describe --tags --always "$TARGET" 2>/dev/null || echo "$TARGET")

echo "🔄 Rebasing Hotfixes onto $TARGET_DESC"
echo "========================================="
$DRY_RUN && echo -e "\033[1;33m(DRY RUN - no changes will be made)\033[0m"
echo ""

# Find all hotfix/* branches
BRANCHES=$(git for-each-ref --format='%(refname:short)' "refs/heads/${HOTFIX_PREFIX}*" 2>/dev/null | sort)

if [[ -z "$BRANCHES" ]]; then
  echo "No ${HOTFIX_PREFIX}* branches found"
  exit 0
fi

UPDATED_BRANCHES=()
SKIPPED_BRANCHES=()
FAILED_BRANCHES=()

for branch in $BRANCHES; do
  id="${branch#"$HOTFIX_PREFIX"}"
  BRANCH_SHA=$(git rev-parse "$branch")

  # Check if already based on target
  MERGE_BASE=$(git merge-base "$TARGET" "$branch" 2>/dev/null || echo "")

  if [[ "$MERGE_BASE" == "$TARGET_SHA" ]]; then
    echo "✅ [$id] already based on $TARGET_DESC"
    SKIPPED_BRANCHES+=("$branch")
    continue
  fi

  # Check if hotfix is already in target (merged upstream)
  if git merge-base --is-ancestor "$BRANCH_SHA" "$TARGET" 2>/dev/null; then
    echo "⚪ [$id] already merged into $TARGET_DESC (consider deleting)"
    SKIPPED_BRANCHES+=("$branch")
    continue
  fi

  COMMIT_COUNT=$(git rev-list --count "$MERGE_BASE".."$branch" 2>/dev/null || echo "0")

  echo ""
  echo "🔧 [$id] ($COMMIT_COUNT commits)"
  git rev-list --oneline "$MERGE_BASE".."$branch" | sed 's/^/   /'

  if $DRY_RUN; then
    echo "   📋 Would rebase onto $TARGET_DESC"
    UPDATED_BRANCHES+=("$branch")
    continue
  fi

  # Create a temporary worktree to perform the rebase
  TEMP_WORKTREE=$(mktemp -d -t "clawdbot-hotfix-rebase-XXXXXX")

  cleanup_worktree() {
    if [[ -d "$TEMP_WORKTREE" ]]; then
      git worktree remove --force "$TEMP_WORKTREE" 2>/dev/null || rm -rf "$TEMP_WORKTREE"
    fi
  }
  trap cleanup_worktree EXIT

  echo "   🔄 Rebasing..."

  # Create worktree for the branch
  if ! git worktree add --quiet "$TEMP_WORKTREE" "$branch" 2>/dev/null; then
    echo "   ❌ Failed to create worktree"
    FAILED_BRANCHES+=("$branch")
    cleanup_worktree
    continue
  fi

  # Attempt rebase in the worktree
  if (cd "$TEMP_WORKTREE" && git rebase "$TARGET" 2>&1); then
    # Rebase succeeded, update the branch
    REBASED_SHA=$(cd "$TEMP_WORKTREE" && git rev-parse HEAD)

    # Update branch ref
    git update-ref "refs/heads/$branch" "$REBASED_SHA"

    echo "   ✅ Rebased successfully"
    echo "   📝 Old: ${BRANCH_SHA:0:9}"
    echo "   📝 New: ${REBASED_SHA:0:9}"

    UPDATED_BRANCHES+=("$branch")
  else
    echo "   ❌ Rebase failed with conflicts"
    echo ""
    echo "   To resolve manually:"
    echo "     1. cd $TEMP_WORKTREE"
    echo "     2. Resolve conflicts and run: git add -A && git rebase --continue"
    echo "     3. Update branch: git update-ref refs/heads/$branch \$(git rev-parse HEAD)"
    echo "     4. Clean up: git worktree remove --force $TEMP_WORKTREE"
    echo ""

    FAILED_BRANCHES+=("$branch")
    trap - EXIT  # Don't auto-cleanup on failure
    continue
  fi

  cleanup_worktree
  trap - EXIT
done

echo ""
echo "========================================="
echo "Summary:"
echo "  ✅ Skipped: ${#SKIPPED_BRANCHES[@]}"
echo "  🔄 Updated: ${#UPDATED_BRANCHES[@]}"
echo "  ❌ Failed: ${#FAILED_BRANCHES[@]}"
echo ""

if [[ ${#FAILED_BRANCHES[@]} -gt 0 ]]; then
  echo "⚠️  Some branches failed to rebase. See errors above."
  echo ""
fi

if $DRY_RUN; then
  echo -e "\033[1;33m(DRY RUN - no changes were made)\033[0m"
  echo ""
  echo "To apply these changes, run without --dry-run"
  exit 0
fi

if [[ ${#UPDATED_BRANCHES[@]} -eq 0 ]]; then
  echo "No branches needed rebasing."
  exit 0
fi

# Offer to force-push updated branches
echo "Updated branches need to be force-pushed to update remotes:"
for branch in "${UPDATED_BRANCHES[@]}"; do
  echo "  - $branch"
done
echo ""

if ! $FORCE; then
  read -p "Force-push these branches? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipped force-push. Branches are updated locally only."
    echo "To push manually: git push --force-with-lease origin <branch>"
    exit 0
  fi
fi

# Force-push updated branches
echo "🚀 Force-pushing updated branches..."
for branch in "${UPDATED_BRANCHES[@]}"; do
  echo "  Pushing $branch..."
  if git push --force-with-lease origin "$branch" 2>&1; then
    echo "  ✅ Pushed $branch"
  else
    echo "  ❌ Failed to push $branch"
  fi
done

echo ""
echo "✅ Hotfix rebase complete!"
