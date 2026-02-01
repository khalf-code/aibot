---
summary: "CLI reference for `zoidbergbot plugins` (list, install, enable/disable, doctor)"
read_when:
  - You want to install or manage in-process Gateway plugins
  - You want to debug plugin load failures
title: "plugins"
---

# `zoidbergbot plugins`

Manage Gateway plugins/extensions (loaded in-process).

Related:

- Plugin system: [Plugins](/plugin)
- Plugin manifest + schema: [Plugin manifest](/plugins/manifest)
- Security hardening: [Security](/gateway/security)

## Commands

```bash
zoidbergbot plugins list
zoidbergbot plugins info <id>
zoidbergbot plugins enable <id>
zoidbergbot plugins disable <id>
zoidbergbot plugins doctor
zoidbergbot plugins update <id>
zoidbergbot plugins update --all
```

Bundled plugins ship with ZoidbergBot but start disabled. Use `plugins enable` to
activate them.

All plugins must ship a `zoidbergbot.plugin.json` file with an inline JSON Schema
(`configSchema`, even if empty). Missing/invalid manifests or schemas prevent
the plugin from loading and fail config validation.

### Install

```bash
zoidbergbot plugins install <path-or-spec>
```

Security note: treat plugin installs like running code. Prefer pinned versions.

Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
zoidbergbot plugins install -l ./my-plugin
```

### Update

```bash
zoidbergbot plugins update <id>
zoidbergbot plugins update --all
zoidbergbot plugins update <id> --dry-run
```

Updates only apply to plugins installed from npm (tracked in `plugins.installs`).
