---
summary: "CLI reference for `zoidbergbot status` (diagnostics, probes, usage snapshots)"
read_when:
  - You want a quick diagnosis of channel health + recent session recipients
  - You want a pasteable “all” status for debugging
title: "status"
---

# `zoidbergbot status`

Diagnostics for channels + sessions.

```bash
zoidbergbot status
zoidbergbot status --all
zoidbergbot status --deep
zoidbergbot status --usage
```

Notes:

- `--deep` runs live probes (WhatsApp Web + Telegram + Discord + Google Chat + Slack + Signal).
- Output includes per-agent session stores when multiple agents are configured.
- Overview includes Gateway + node host service install/runtime status when available.
- Overview includes update channel + git SHA (for source checkouts).
- Update info surfaces in the Overview; if an update is available, status prints a hint to run `zoidbergbot update` (see [Updating](/install/updating)).
