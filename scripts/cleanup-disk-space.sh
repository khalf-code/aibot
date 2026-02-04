#!/usr/bin/env bash
set -euo pipefail

# Parse arguments
AGGRESSIVE=true
if [[ "${1:-}" == "--aggressive" ]]; then
  AGGRESSIVE=true
  shift
fi

echo "=== OpenClaw Disk Space Cleanup Script ==="
if [ "$AGGRESSIVE" = true ]; then
  echo "(AGGRESSIVE MODE: cleaning files >1 day, keeping fewer snapshots)"
fi
echo ""

# Show disk usage diagnostics for /data if it exists
if [ -d /data ]; then
  echo "Checking /data volume usage..."
  df -h /data 2>/dev/null || true
  echo ""
  echo "Top 10 largest items in /data:"
  du -sh /data/* 2>/dev/null | sort -h | tail -10 || true
  echo ""
fi

# Function to show size before and after
show_cleanup() {
  local name=$1
  local path=$2
  if [ -e "$path" ]; then
    local before=$(du -sh "$path" 2>/dev/null | cut -f1)
    echo "Cleaning $name ($before)..."
    return 0
  else
    echo "Skipping $name (not found)"
    return 1
  fi
}

# Clean npm cache (safe)
if show_cleanup "npm cache" ~/.npm; then
  npm cache clean --force
  echo "  ✓ npm cache cleaned"
fi

# Clean yarn cache (safe)
if show_cleanup "Yarn cache" ~/Library/Caches/Yarn; then
  yarn cache clean --all 2>/dev/null || rm -rf ~/Library/Caches/Yarn
  echo "  ✓ Yarn cache cleaned"
fi

# Clean pnpm store (safe, will re-download)
if [ -d ~/.pnpm-store ]; then
  show_cleanup "pnpm store" ~/.pnpm-store
  pnpm store prune || rm -rf ~/.pnpm-store
  echo "  ✓ pnpm store cleaned"
fi

# Clean Homebrew cache (safe)
if show_cleanup "Homebrew cache" ~/Library/Caches/Homebrew; then
  brew cleanup -s 2>/dev/null || rm -rf ~/Library/Caches/Homebrew
  echo "  ✓ Homebrew cache cleaned"
fi

# Clean Docker (if installed)
if command -v docker &> /dev/null; then
  echo "Cleaning Docker..."
  docker system prune -af --volumes || true
  echo "  ✓ Docker cleaned"
fi

# Clean browser caches (optional - will log you out)
read -p "Clean browser caches? (Arc, Google, Firefox) [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf ~/Library/Caches/Arc 2>/dev/null || true
  rm -rf ~/Library/Caches/Google 2>/dev/null || true
  rm -rf ~/Library/Caches/Firefox 2>/dev/null || true
  echo "  ✓ Browser caches cleaned"
fi

# Clean OpenClaw browser cache (safe)
if show_cleanup "OpenClaw browser cache" ~/.openclaw/browser; then
  rm -rf ~/.openclaw/browser/*
  echo "  ✓ OpenClaw browser cache cleaned"
fi

# Set thresholds based on aggressive mode
AGE_THRESHOLD=7
SNAPSHOT_KEEP=10
if [ "$AGGRESSIVE" = true ]; then
  AGE_THRESHOLD=1
  SNAPSHOT_KEEP=3
fi

# Clean old OpenClaw session logs
echo "Cleaning old OpenClaw session logs (>${AGE_THRESHOLD} days)..."
find ~/.openclaw/agents/*/sessions -name "*.jsonl" -mtime +${AGE_THRESHOLD} -delete 2>/dev/null || true
echo "  ✓ Old session logs cleaned"

# Clean OpenClaw memory snapshots
if [ -d ~/.openclaw/memory ]; then
  echo "Cleaning old OpenClaw memory snapshots (keep last ${SNAPSHOT_KEEP})..."
  cd ~/.openclaw/memory
  ls -t snapshot-*.json 2>/dev/null | tail -n +$((SNAPSHOT_KEEP + 1)) | xargs rm -f || true
  echo "  ✓ Old memory snapshots cleaned"
fi

# Clean /data volume (Render-specific persistent disk)
if [ -d /data/.openclaw ]; then
  echo "Cleaning /data/.openclaw (Render persistent volume)..."

  # Clean old session logs from /data
  find /data/.openclaw/agents/*/sessions -name "*.jsonl" -mtime +${AGE_THRESHOLD} -delete 2>/dev/null || true

  # Clean browser cache from /data
  rm -rf /data/.openclaw/browser/* 2>/dev/null || true

  # Clean old memory snapshots from /data
  if [ -d /data/.openclaw/memory ]; then
    cd /data/.openclaw/memory
    ls -t snapshot-*.json 2>/dev/null | tail -n +$((SNAPSHOT_KEEP + 1)) | xargs rm -f || true
  fi

  # Clean node_modules (biggest space hog)
  if [ -d /data/workspace ]; then
    echo "  - Removing node_modules directories..."
    find /data/workspace -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
  fi

  # Clean large workspace files
  if [ -d /data/workspace ]; then
    if [ "$AGGRESSIVE" = true ]; then
      echo "  - Removing large workspace files (>100MB, >1 day)..."
      find /data/workspace -type f -size +100M -mtime +1 -delete 2>/dev/null || true
      echo "  - Removing all workspace files >7 days..."
      find /data/workspace -type f -mtime +7 -delete 2>/dev/null || true
    else
      find /data/workspace -type f -size +100M -mtime +7 -delete 2>/dev/null || true
    fi
  fi

  echo "  ✓ /data volume cleaned"
fi

echo ""
echo "=== Cleanup Complete ==="
echo ""
echo "Disk usage after cleanup:"
df -h /
# Also show /data if it exists
if [ -d /data ]; then
  echo ""
  echo "/data volume usage:"
  df -h /data || true
fi
echo ""
echo "OpenClaw directory size:"
du -sh ~/.openclaw
if [ -d /data/.openclaw ]; then
  echo "OpenClaw /data directory size:"
  du -sh /data/.openclaw || true
fi
