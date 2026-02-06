# OpenClaw CN Desktop (Windows + Ubuntu)

This is a cross-platform desktop shell for the OpenClaw Control UI.

Design goals:
- Reuse upstream Control UI as-is (minimize merge conflicts).
- Run the UI from a local loopback HTTP server (works with gateway origin checks).
- Keep the gateway as the source of truth via RPC (restart/update/model switching, etc.).

## Development

1) Build / run the gateway as usual (or point to an existing gateway).
2) Run the UI dev server:

```bash
corepack pnpm --dir ui dev
```

3) Run the desktop app:

```bash
OPENCLAW_CN_UI_URL=http://127.0.0.1:5173 corepack pnpm --dir apps/desktop dev
```

## Packaging

The desktop app bundles the built Control UI from `dist/control-ui`.

```bash
corepack pnpm ui:build
corepack pnpm --dir apps/desktop dist
```

