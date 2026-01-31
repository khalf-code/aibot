FROM node:22-bullseye-slim

# Install bun and enable corepack
RUN apt-get update && apt-get install -y curl \
  && curl -fsSL https://bun.sh/install | bash \
  && corepack enable

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# ✅ Skip canvas and UI builds, assume prebuilt assets exist
RUN pnpm ui:install

# Create data directory
RUN mkdir -p /data/.clawdbot

# Set entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Default entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]
