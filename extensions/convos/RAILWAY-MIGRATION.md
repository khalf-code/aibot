# Railway Template Migration: Convos Setup via RPCs

This document is for the agent updating the `clawdbot-railway-template` repo.
The OpenClaw Convos extension now exposes gateway RPCs for setup, eliminating
the need for the template to bundle its own XMTP agent logic.

## RPC API

All RPCs are called via the gateway WebSocket (or HTTP JSON-RPC) at
`ws://127.0.0.1:18789/ws` (or `http://127.0.0.1:18789/rpc`).

| Method | Params | Returns | Notes |
|--------|--------|---------|-------|
| `convos.setup` | `{ env?, name?, accountId? }` | `{ inviteUrl, conversationId, qrDataUrl }` | Creates XMTP identity + conversation in memory. `qrDataUrl` is a `data:image/png;base64,...` string ready for an `<img src>`. |
| `convos.setup.status` | none | `{ active, joined, joinerInboxId }` | Poll every 3 seconds. `joined` becomes `true` when a user scans the invite and joins. |
| `convos.setup.complete` | none | `{ saved: true, conversationId }` | Persists the identity + conversation to config. Triggers a single gateway restart. Call this only after `joined === true`. |

## New Template Flow

1. **Start the gateway** with minimal config (`gateway.mode=local` pre-set).
   No Convos config needed yet -- the gateway starts without the channel.

2. **Call `convos.setup`** via the gateway RPC endpoint.
   - Returns `inviteUrl`, `conversationId`, and `qrDataUrl`.
   - The setup agent stays running in memory to accept join requests.
   - No config is written at this point, so there are no gateway restarts.

3. **Display the QR code** in the `/setup` page.
   - Use `qrDataUrl` directly as an `<img src>` attribute.
   - No client-side QR library needed.
   - Also display `inviteUrl` as a clickable/copyable link.

4. **Poll `convos.setup.status`** every 3 seconds.
   - When `joined === true`, the user has scanned the QR and joined.

5. **Call `convos.setup.complete`** after join is confirmed.
   - This writes the XMTP private key, conversation ID, and environment to config.
   - The gateway restarts once with the complete Convos config.
   - The normal Convos channel picks up the config and starts.

6. **Configure remaining settings** (AI model, API key, etc.) via
   `openclaw config set` or the config RPC, then restart the gateway.

## What to Remove from the Template

- **`convos-setup.js`** (or equivalent) -- all XMTP agent creation logic.
- **`@xmtp/agent-sdk`** and **`convos-node-sdk`** from `package.json` dependencies.
- Any code that calls `openclaw config set channels.convos.privateKey ...` directly.
  Config writes are now handled by `convos.setup.complete`.

## Example: Calling RPCs from the Template Server

```javascript
// Using WebSocket (ws library)
const ws = new WebSocket("ws://127.0.0.1:18789/ws");

function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener("message", handler);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  });
}

// 1. Start setup
const setup = await rpc("convos.setup", { env: "production", name: "My Bot" });
// setup.inviteUrl   -- invite link
// setup.qrDataUrl   -- data:image/png;base64,... for <img src>
// setup.conversationId

// 2. Poll for join
const poll = setInterval(async () => {
  const status = await rpc("convos.setup.status");
  if (status.joined) {
    clearInterval(poll);
    // 3. Save config
    await rpc("convos.setup.complete");
    console.log("Convos configured and running!");
  }
}, 3000);
```

## Architecture Change

**Before (current template):**
1. Template creates its own XMTP agent (duplicated SDK logic)
2. Template saves config via `openclaw config set`
3. Template starts gateway
4. Multiple config writes cause cascading restarts

**After:**
1. Template starts gateway (minimal config)
2. Template calls gateway RPCs for Convos setup
3. Single config write after join confirmed
4. One clean restart

All Convos SDK logic lives in the OpenClaw extension. The template just calls
RPCs. Template updates automatically benefit from new Convos features without
code changes.
