#!/usr/bin/env bash
set -euo pipefail

# Get historical APY/TVL data for a specific pool
# Usage: ./pool-history.sh <pool-id>

POOL_ID="${1:?Usage: pool-history.sh <pool-id>}"

curl -sf "https://yields.llama.fi/chart/${POOL_ID}" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const recent = (data.data || []).slice(-30).map(d => ({
  date: d.timestamp.split('T')[0],
  tvlUsd: d.tvlUsd,
  apy: d.apy,
  apyBase: d.apyBase,
  apyReward: d.apyReward,
}));
console.log(JSON.stringify(recent, null, 2));
"
