#!/bin/bash
# Weekly synthesis cron setup
# Creates or updates a Sunday 9pm digest job.

set -euo pipefail

NAME="${WEEKLY_SYNTHESIS_NAME:-Weekly Synthesis}"
CRON_EXPR="${WEEKLY_SYNTHESIS_CRON:-0 21 * * 0}"
TZ="${WEEKLY_SYNTHESIS_TZ:-}"
PROVIDER="${WEEKLY_SYNTHESIS_PROVIDER:-last}"
TO="${WEEKLY_SYNTHESIS_TO:-}"
POST_PREFIX="${WEEKLY_SYNTHESIS_POST_PREFIX:-Weekly Synthesis}"
MESSAGE_FILE="${WEEKLY_SYNTHESIS_MESSAGE_FILE:-}"
THINKING_LEVEL="${WEEKLY_SYNTHESIS_THINKING:-low}"
DESCRIPTION="Sunday 9pm digest"

if ! command -v clawdbot >/dev/null 2>&1; then
  echo "Error: clawdbot CLI not found on PATH." >&2
  exit 1
fi

MESSAGE=$(cat <<'PROMPT'
Create a weekly synthesis for the last 7 days.

Use any available context (sessions, notes, calendar, tasks/beads, git activity, messages). Sources are optional; if a source isn't available, omit it or note "No data available".

Output format (Markdown):
- Highlights (3-5 bullets)
- Progress & wins
- Open threads / blockers
- Next week focus (3 bullets)
- Questions / decisions needed
- Health (optional; include only if data is available)

Keep it concise and friendly. Avoid fluff.
PROMPT
)

if [[ -n "$MESSAGE_FILE" ]]; then
  if [[ ! -f "$MESSAGE_FILE" ]]; then
    echo "Error: message file not found: $MESSAGE_FILE" >&2
    exit 1
  fi
  MESSAGE="$(cat "$MESSAGE_FILE")"
fi

EXTRA_ARGS=("$@")

if ! JOBS_JSON="$(clawdbot cron list --json "${EXTRA_ARGS[@]}")"; then
  echo "Error: failed to list cron jobs. Is the gateway running?" >&2
  exit 1
fi

JOB_ID=$(python3 - "$NAME" <<'PY'
import json
import sys

name = sys.argv[1]
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

for job in data.get("jobs", []) or []:
    if job.get("name") == name:
        print(job.get("id", ""))
        break
PY
)

COMMON_ARGS=(
  --session isolated
  --wake now
  --message "$MESSAGE"
  --deliver
  --provider "$PROVIDER"
  --best-effort-deliver
  --post-prefix "$POST_PREFIX"
  --description "$DESCRIPTION"
  --thinking "$THINKING_LEVEL"
)

if [[ -n "$TO" ]]; then
  COMMON_ARGS+=(--to "$TO")
fi

if [[ -n "$TZ" ]]; then
  COMMON_ARGS+=(--tz "$TZ")
fi

if [[ -n "$JOB_ID" ]]; then
  clawdbot cron edit "$JOB_ID" --name "$NAME" --cron "$CRON_EXPR" "${COMMON_ARGS[@]}" "${EXTRA_ARGS[@]}"
  echo "Updated weekly synthesis job: $JOB_ID"
else
  clawdbot cron add --name "$NAME" --cron "$CRON_EXPR" "${COMMON_ARGS[@]}" "${EXTRA_ARGS[@]}"
  echo "Created weekly synthesis job."
fi
