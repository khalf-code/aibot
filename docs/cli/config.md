---
summary: "CLI reference for `zoidbergbot config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `zoidbergbot config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `zoidbergbot configure`).

## Examples

```bash
zoidbergbot config get browser.executablePath
zoidbergbot config set browser.executablePath "/usr/bin/google-chrome"
zoidbergbot config set agents.defaults.heartbeat.every "2h"
zoidbergbot config set agents.list[0].tools.exec.node "node-id-or-name"
zoidbergbot config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
zoidbergbot config get agents.defaults.workspace
zoidbergbot config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
zoidbergbot config get agents.list
zoidbergbot config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
zoidbergbot config set agents.defaults.heartbeat.every "0m"
zoidbergbot config set gateway.port 19001 --json
zoidbergbot config set channels.whatsapp.groups '["*"]' --json
```

Restart the gateway after edits.
