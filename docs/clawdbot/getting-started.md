---
summary: "Bootstrap a local Clawdbot development environment on macOS (Intel or Apple Silicon) with a single command."
read_when:
  - Setting up Clawdbot for the first time
  - Running Clawdbot locally on a Mac
  - Bootstrap script usage
title: "Getting Started with Clawdbot"
---

# Getting Started with Clawdbot

This guide walks you through bootstrapping a local Clawdbot development environment on macOS. The bootstrap script works on both Intel and Apple Silicon Macs.

## Prerequisites

Before running the bootstrap script, make sure you have:

- **Node.js 22+** -- check with `node --version`
- **pnpm** -- install with `npm install -g pnpm` or `corepack enable`
- **Docker** (optional) -- only needed for containerized dev and e2e tests

## Quick start

Clone the repo and run the bootstrap script:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
bash scripts/bootstrap.sh
```

That single command will:

1. Verify your Node.js and pnpm versions meet the minimum requirements
2. Install all project dependencies via `pnpm install`
3. Copy `config/profiles/dev.env` to `.env` if no `.env` exists yet (safe-by-default dev settings)
4. Create `~/.openclaw` if it does not already exist

## Options

| Flag            | Description                                                           |
| --------------- | --------------------------------------------------------------------- |
| `--with-docker` | Start Docker services (from `docker-compose.yml`) after setup         |
| `--skip-deps`   | Skip `pnpm install` (useful when dependencies are already up to date) |
| `--help`        | Show usage information                                                |

### Examples

Skip dependency install when you have already run `pnpm install`:

```bash
bash scripts/bootstrap.sh --skip-deps
```

Start Docker services alongside the bootstrap:

```bash
bash scripts/bootstrap.sh --with-docker
```

## What the script does

### Prerequisite checks

The script verifies that `node` (v22+) and `pnpm` are available on your PATH. If Docker is installed and the daemon is running, the script notes it as available for optional use. Missing prerequisites produce a clear error message with install instructions.

### Dependency installation

Unless `--skip-deps` is passed, the script runs `pnpm install` in the project root to fetch all workspace dependencies.

### Configuration profiles

OpenClaw ships two config profiles under `config/profiles/`:

- **`dev.env`** -- safe-by-default development settings (no external sends, mock endpoints, debug logging)
- **`prod.env`** -- production settings (not used during local development)

The bootstrap script copies `dev.env` to `.env` at the project root so that local dev runs safely out of the box. If an `.env` already exists, it is left untouched.

### Docker services (optional)

When `--with-docker` is passed and Docker is available, the script starts the services defined in `docker-compose.yml`. Note that some environment variables must be set first:

- `OPENCLAW_CONFIG_DIR`
- `OPENCLAW_WORKSPACE_DIR`
- `OPENCLAW_GATEWAY_TOKEN`

See the [Docker install guide](/install/docker) for details.

## After bootstrapping

Once the bootstrap completes, common next steps are:

```bash
# Run the CLI in dev mode
pnpm dev

# Build the project
pnpm build

# Run tests
pnpm test

# Start the gateway locally
pnpm openclaw gateway run
```

For full setup details (workspace tailoring, macOS app, bleeding-edge workflows), see [Setup](/start/setup).

## Architecture compatibility

The bootstrap script detects your Mac architecture automatically. Both Intel (`x86_64`) and Apple Silicon (`arm64`) are fully supported. No architecture-specific flags or configuration are needed -- all Node.js and pnpm operations work identically on both.

## Troubleshooting

- **Node version too old:** upgrade Node to 22+ via your preferred method (nvm, Homebrew, installer from nodejs.org)
- **pnpm not found:** run `npm install -g pnpm` or enable Corepack with `corepack enable`
- **Docker compose fails:** ensure the required environment variables are set in your `.env` file (see the Docker services section above)
- **General issues:** run `openclaw doctor` for automated diagnostics (see [Doctor](/gateway/doctor))
