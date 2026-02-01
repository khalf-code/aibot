---
summary: "CLI reference for `zoidbergbot agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "agents"
---

# `zoidbergbot agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
zoidbergbot agents list
zoidbergbot agents add work --workspace ~/.zoidbergbot/workspace-work
zoidbergbot agents set-identity --workspace ~/.zoidbergbot/workspace --from-identity
zoidbergbot agents set-identity --agent main --avatar avatars/zoidbergbot.png
zoidbergbot agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.zoidbergbot/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
zoidbergbot agents set-identity --workspace ~/.zoidbergbot/workspace --from-identity
```

Override fields explicitly:

```bash
zoidbergbot agents set-identity --agent main --name "ZoidbergBot" --emoji "🦞" --avatar avatars/zoidbergbot.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "ZoidbergBot",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/zoidbergbot.png",
        },
      },
    ],
  },
}
```
