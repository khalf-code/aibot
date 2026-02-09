#!/usr/bin/env bash
set -euo pipefail

# Execute a Dune Analytics query by ID
# Usage: ./dune-query.sh <query-id>
# Requires: DUNE_API_KEY environment variable

QUERY_ID="${1:?Usage: dune-query.sh <query-id>}"

if [[ -z "${DUNE_API_KEY:-}" ]]; then
  echo '{"error":"DUNE_API_KEY not set. Configure it in .env."}' >&2
  exit 1
fi

# Execute query and wait for results
EXEC=$(curl -sf -X POST "https://api.dune.com/api/v1/query/${QUERY_ID}/execute" \
  -H "X-Dune-API-Key: ${DUNE_API_KEY}")

EXEC_ID=$(echo "$EXEC" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).execution_id)")

# Poll for results (max 60s)
for i in $(seq 1 12); do
  sleep 5
  RESULT=$(curl -sf "https://api.dune.com/api/v1/execution/${EXEC_ID}/results" \
    -H "X-Dune-API-Key: ${DUNE_API_KEY}")

  STATE=$(echo "$RESULT" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).state)")

  if [[ "$STATE" == "QUERY_STATE_COMPLETED" ]]; then
    echo "$RESULT" | node -e "
const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log(JSON.stringify({
  queryId: ${QUERY_ID},
  rows: (r.result?.rows || []).slice(0, 50),
  totalRows: r.result?.metadata?.total_row_count || 0
}, null, 2));
"
    exit 0
  fi
done

echo '{"error":"Query timed out after 60s"}' >&2
exit 1
