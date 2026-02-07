# Dev container for OpenClaw
# Based on the official Microsoft TypeScript/Node devcontainer image.
# Pinned to Node 22 (Bookworm/Debian 12) for reproducibility.
# See: https://mcr.microsoft.com/en-us/artifact/mar/devcontainers/typescript-node/tags
FROM mcr.microsoft.com/devcontainers/typescript-node:1.1.2-22-bookworm

# ---- System packages needed by native deps (sharp, node-pty, sqlite-vec) ----
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        git \
        curl \
        jq \
        # sharp native image codec libs
        libvips-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ---- pnpm (corepack) ----
# The base image ships corepack; enable it so the pinned packageManager field works.
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# ---- Bun (used for TS execution / dev scripts) ----
# Pin to a specific version for reproducibility.
ARG BUN_VERSION=1.2.4
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash -s "bun-v${BUN_VERSION}"

# Keep the default non-root "node" user from the base image.
# The devcontainer.json remoteUser field takes care of switching.
