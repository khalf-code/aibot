#!/usr/bin/env bash
set -euo pipefail

# OpenClaw UI snapshot bundle (Peekaboo)
#
# Captures a small, consistent set of artifacts that are useful when debugging
# OpenClaw UI state (menubar/dashboard/control UI).
#
# Requires:
#   - macOS
#   - peekaboo CLI (brew install steipete/tap/peekaboo)
#   - Screen Recording + Accessibility permissions for your terminal app
#
# Usage:
#   scripts/openclaw-ui-snapshot.sh
#   scripts/openclaw-ui-snapshot.sh /tmp/my-snapshot-dir

out="${1:-}"
if [[ -z "${out}" ]]; then
  ts="$(date +%Y%m%d-%H%M%S)"
  out="/tmp/openclaw-ui-snapshot-${ts}"
fi

mkdir -p "${out}"

echo "Output: ${out}"

if ! command -v peekaboo >/dev/null 2>&1; then
  cat <<'EOF' >&2
Error: peekaboo is not installed or not on PATH.

Install:
  brew install steipete/tap/peekaboo

Then grant Screen Recording + Accessibility permissions and re-run.
EOF
  exit 1
fi

# Permission/status + discovery JSON. Keep these non-fatal so you still get what
# you can even if some subcommands error.
peekaboo permissions > "${out}/peekaboo-permissions.txt" || true
peekaboo menubar list --json > "${out}/menubar.json" || true
peekaboo list windows --json > "${out}/windows.json" || true

# Images: both the whole screen (good for “what’s visible?”) and the frontmost
# window (good for “what’s focused?”).
peekaboo image --mode screen --screen-index 0 --retina --path "${out}/screen.png" || true
peekaboo image --mode frontmost --retina --path "${out}/frontmost.png" || true

# UI map (annotated) for stable element IDs.
peekaboo see --mode screen --screen-index 0 --annotate --path "${out}/ui-map.png" || true

echo "Saved bundle: ${out}"
echo "Key files: frontmost.png, ui-map.png, peekaboo-permissions.txt"