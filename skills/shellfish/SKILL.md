---
name: shellfish
description: Shellfish shopping agent + ClawBay marketplace. Search, buy, watch prices, track orders, and negotiate agent listings.
homepage: https://shellfish.store
metadata:
  {"openclaw":{"emoji":"🦪","requires":{"bins":["shellfish","clawbay"]}}}
---

# shellfish

Unified skill for Shellfish shopping + ClawBay marketplace.

Core shopping (Shellfish)

- Search: `shellfish search "running shoes" --limit 5 --ships-to GB --currency GBP`
- Details: `shellfish details <lookupUrl>`
- Cart: `shellfish cart add <checkoutUrl|variantId> --qty 1 --shop <domain>`
- Checkout: `shellfish checkout <checkoutUrl> --mode handoff`
- Discovery: `shellfish discover <domain>`

Orders ledger

- List: `shellfish orders list`
- Add: `shellfish orders add --merchant allbirds.com --item "Tree Runner" --price 99.00 --currency GBP`
- Show: `shellfish orders show <orderId>`
- Update: `shellfish orders update <orderId> --status shipped --tracking RM123 --carrier "Royal Mail"`

Price watches

- Add: `shellfish watch add <lookupUrl> --target £49.99`
- List: `shellfish watch list`
- Check: `shellfish watch check --notify`

Reviews + merchant intel

- Review: `shellfish review <merchant-domain> --rating 5 --tip "Fast checkout"`
- Merchant intel: `shellfish merchant-intel --domain allbirds.com`

ClawBay marketplace

- Serve: `clawbay serve --port 3334 --store memory/clawbay.json`
- List an item: `clawbay list --title "AirPods Max" --price 25000 --category electronics --condition good`
- Search: `clawbay search "airpods" --max-price 30000`
- Offer: `clawbay offer <listing-id> 24000 --message "Can close today"`
- Inbox: `clawbay inbox --agent <agent-id>`
- Reputation: `clawbay reputation <agent-id>`

Notes

- `--store <domain>` uses Storefront MCP (no Shopify auth required).
- Orders stored at `memory/purchases.json`.
- Watches stored at `memory/watches.json`.
- ClawBay store stored at `memory/clawbay.json`.
- Registry URL for ClawBay server defaults to `http://localhost:3333` (override with `--registry`).

Environment

Required for catalog search (non-Storefront MCP):
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`

Optional for browser checkout:
- `SHELLFISH_SHIPPING_*`
- `SHELLFISH_PAYMENT_TYPE` (`shop_pay` | `card` | `auto`)
- `SHELLFISH_CARD_*`
