#!/usr/bin/env bash
set -euo pipefail

# Search DeFi yield pools via DeFiLlama /pools endpoint
# Usage: ./search-pools.sh [--chain Chain] [--project project] [--symbol SYM] [--min-tvl N] [--min-apy N]

CHAIN="" PROJECT="" SYMBOL="" MIN_TVL=0 MIN_APY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --chain)   CHAIN="$2";   shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --symbol)  SYMBOL="$2";  shift 2 ;;
    --min-tvl) MIN_TVL="$2"; shift 2 ;;
    --min-apy) MIN_APY="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Fetch all pools from DeFiLlama
DATA=$(curl -sf "https://yields.llama.fi/pools" | npx -y json -a pool chain project symbol tvlUsd apy apyBase apyReward stablecoin apyMean30d)

# Apply filters via node one-liner for portability
echo "$DATA" | node -e "
const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n');
const chain = '${CHAIN}'.toLowerCase();
const project = '${PROJECT}'.toLowerCase();
const symbol = '${SYMBOL}'.toUpperCase();
const minTvl = ${MIN_TVL};
const minApy = ${MIN_APY};

let pools = lines.map(l => {
  const [pool, ch, proj, sym, tvl, apy, apyBase, apyReward, stable, mean30d] = l.split('\t');
  return { pool, chain: ch, project: proj, symbol: sym, tvlUsd: +tvl, apy: +apy, apyBase: +apyBase, apyReward: +apyReward, stablecoin: stable === 'true', apyMean30d: +mean30d };
});

if (chain)   pools = pools.filter(p => p.chain.toLowerCase() === chain);
if (project) pools = pools.filter(p => p.project.toLowerCase() === project);
if (symbol)  pools = pools.filter(p => p.symbol.toUpperCase().includes(symbol));
if (minTvl)  pools = pools.filter(p => p.tvlUsd >= minTvl);
if (minApy)  pools = pools.filter(p => p.apy >= minApy);

pools.sort((a, b) => b.apy - a.apy);
console.log(JSON.stringify(pools.slice(0, 20), null, 2));
"
