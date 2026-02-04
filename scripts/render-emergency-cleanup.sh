#!/bin/bash
# Emergency cleanup for Render /data persistent disk
# This removes all non-essential data from /data to free up space

set -e

echo "=== Render /data Emergency Cleanup ==="
echo ""

echo "Before cleanup:"
df -h /data || true
echo ""

echo "Removing node_modules from workspace..."
find /data/workspace -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true

echo "Removing workspace (will be moved to ephemeral storage)..."
rm -rf /data/workspace 2>/dev/null || true

echo "Removing session logs (will be moved to ephemeral storage)..."
rm -rf /data/.openclaw/agents 2>/dev/null || true

echo "Removing browser cache..."
rm -rf /data/.openclaw/browser 2>/dev/null || true

echo "Removing memory snapshots..."
rm -rf /data/.openclaw/memory 2>/dev/null || true

echo "Removing temp files..."
rm -rf /data/.openclaw/tmp 2>/dev/null || true

echo ""
echo "After cleanup:"
df -h /data || true
echo ""

echo "Remaining /data contents (should be just config):"
du -sh /data/.openclaw/* 2>/dev/null || echo "Only openclaw.json should remain"
ls -lah /data/.openclaw/ 2>/dev/null || true

echo ""
echo "✓ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy updated render-start.sh (already committed)"
echo "2. Restart the Render service"
echo "3. Workspace and sessions will use ephemeral storage (290GB available)"
