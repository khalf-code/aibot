---
summary: "CLI reference for `zoidbergbot logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `zoidbergbot logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
zoidbergbot logs
zoidbergbot logs --follow
zoidbergbot logs --json
zoidbergbot logs --limit 500
```
