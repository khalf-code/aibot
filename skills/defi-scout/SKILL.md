---
name: defi-scout
description: "Scan DeFi yield pools via DeFiLlama, analyze trends, query Dune Analytics, and produce structured opportunity briefs. Read-only — no transaction execution."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔭",
        "requires": { "bins": ["npx"] },
      },
  }
---

# defi-scout

Identifies yield gaps, underserved protocols, and DeFi market opportunities using DeFiLlama and Dune Analytics data. All operations are read-only.

## Usage

### Search yield pools

```bash
./scripts/search-pools.sh --chain Base --min-tvl 100000 --min-apy 5
```

Returns up to 20 matching pools sorted by APY descending.

### Get pool history

```bash
./scripts/pool-history.sh <pool-id>
```

Returns last 30 days of APY/TVL data for trend analysis.

### Query Dune Analytics

```bash
./scripts/dune-query.sh <query-id>
```

Executes a pre-approved Dune query (requires `DUNE_API_KEY`).

### Create opportunity brief

```bash
echo '{"type":"yield_gap","title":"...","summary":"...","riskScore":3,"confidence":0.8,"protocols":["aave-v3"],"chains":["Base"],"reasoning":"..."}' | \
  ./scripts/create-brief.sh
```

## Methodology

1. **Scan** — Search yield pools across chains and protocols
2. **Analyze** — Check pool history for trends and anomalies
3. **Research** — Use Dune for on-chain metrics when available
4. **Score** — Assess risk (1-10) and confidence (0-1) for each finding
5. **Brief** — Produce structured opportunity briefs

## Opportunity Types

| Type | Description |
|------|-------------|
| yield_gap | Significant APY difference between similar pools |
| underserved_protocol | Strong fundamentals but low TVL/attention |
| liquidity_opportunity | Exploitable liquidity imbalance |
| tvl_trend | Meaningful TVL movement signaling shifts |
| risk_arbitrage | Mispriced risk-adjusted return |

## Guidelines

- Compare APY against 30-day mean to filter noise
- Consider IL risk, stablecoin status, and exposure type
- Cross-reference multiple data points before creating a brief
- Be skeptical of extremely high APYs — often unsustainable
- Prefer Base, Ethereum, and Arbitrum unless asked otherwise
- Create at most 3-5 briefs per analysis session
- All tools are read-only — briefs inform human decisions, not automated execution
