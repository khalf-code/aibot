#!/usr/bin/env bash
# bootstrap.sh -- one-command local dev setup for OpenClaw (Clawdbot)
# Works on both Intel and Apple Silicon Macs.
# Usage: bash scripts/bootstrap.sh [--with-docker] [--skip-deps] [--help]
#
# GitHub Issue: #4 [RF-003] Mac Intel local runtime bootstrap script

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_DIR="${ROOT_DIR}/config/profiles"
DEV_ENV="${CONFIG_DIR}/dev.env"
LOCAL_ENV="${ROOT_DIR}/.env"
MIN_NODE_MAJOR=22

# ---------------------------------------------------------------------------
# Colors (ANSI, respects NO_COLOR)
# ---------------------------------------------------------------------------
if [[ -z "${NO_COLOR:-}" && -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf "${CYAN}[info]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
fail()  { printf "${RED}[error]${RESET} %s\n" "$*" >&2; exit 1; }

section() {
  printf "\n${BOLD}--- %s ---${RESET}\n\n" "$*"
}

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: bash scripts/bootstrap.sh [OPTIONS]

Bootstrap a local OpenClaw (Clawdbot) development environment.

Options:
  --with-docker   Start Docker services after setup (requires Docker)
  --skip-deps     Skip pnpm install (useful when deps are already installed)
  --help          Show this help message

Examples:
  bash scripts/bootstrap.sh
  bash scripts/bootstrap.sh --with-docker
  bash scripts/bootstrap.sh --skip-deps
EOF
  exit 0
}

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
WITH_DOCKER=0
SKIP_DEPS=0

for arg in "$@"; do
  case "${arg}" in
    --with-docker)  WITH_DOCKER=1 ;;
    --skip-deps)    SKIP_DEPS=1 ;;
    --help|-h)      usage ;;
    *)              warn "Unknown option: ${arg}" ;;
  esac
done

# ---------------------------------------------------------------------------
# Summary tracking
# ---------------------------------------------------------------------------
SUMMARY_ITEMS=()
summary_add() { SUMMARY_ITEMS+=("$1"); }

# ---------------------------------------------------------------------------
# 1. Detect architecture
# ---------------------------------------------------------------------------
section "Environment"

ARCH="$(uname -m)"
OS="$(uname -s)"

if [[ "${OS}" != "Darwin" ]]; then
  warn "This script is designed for macOS. Detected: ${OS}. Proceeding anyway."
fi

if [[ "${ARCH}" == "arm64" ]]; then
  info "Architecture: Apple Silicon (arm64)"
elif [[ "${ARCH}" == "x86_64" ]]; then
  info "Architecture: Intel (x86_64)"
else
  info "Architecture: ${ARCH}"
fi
summary_add "Architecture: ${ARCH} (${OS})"

# ---------------------------------------------------------------------------
# 2. Check Node.js
# ---------------------------------------------------------------------------
section "Prerequisites"

if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node ${MIN_NODE_MAJOR}+ from https://nodejs.org and re-run."
fi

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(echo "${NODE_VERSION}" | sed 's/^v//' | cut -d. -f1)"

if [[ "${NODE_MAJOR}" -lt "${MIN_NODE_MAJOR}" ]]; then
  fail "Node ${MIN_NODE_MAJOR}+ required. Found: ${NODE_VERSION}. Upgrade and re-run."
fi
ok "Node.js ${NODE_VERSION}"
summary_add "Node.js: ${NODE_VERSION}"

# ---------------------------------------------------------------------------
# 3. Check pnpm
# ---------------------------------------------------------------------------
if ! command -v pnpm &>/dev/null; then
  fail "pnpm is not installed. Install it with: npm install -g pnpm (or corepack enable)"
fi

PNPM_VERSION="$(pnpm --version)"
ok "pnpm ${PNPM_VERSION}"
summary_add "pnpm: ${PNPM_VERSION}"

# ---------------------------------------------------------------------------
# 4. Check Docker (optional)
# ---------------------------------------------------------------------------
if command -v docker &>/dev/null; then
  DOCKER_VERSION="$(docker --version 2>/dev/null | sed 's/Docker version //' | cut -d, -f1)"
  if docker info &>/dev/null; then
    ok "Docker ${DOCKER_VERSION} (daemon running)"
    DOCKER_AVAILABLE=1
  else
    warn "Docker ${DOCKER_VERSION} installed but daemon is not running"
    DOCKER_AVAILABLE=0
  fi
  summary_add "Docker: ${DOCKER_VERSION:-installed}"
else
  info "Docker not found (optional -- needed only for containerized dev/e2e)"
  DOCKER_AVAILABLE=0
  summary_add "Docker: not installed (optional)"
fi

# ---------------------------------------------------------------------------
# 5. Install dependencies
# ---------------------------------------------------------------------------
section "Dependencies"

if [[ "${SKIP_DEPS}" -eq 1 ]]; then
  info "Skipping dependency install (--skip-deps)"
  summary_add "Dependencies: skipped"
else
  info "Installing dependencies via pnpm..."
  (cd "${ROOT_DIR}" && pnpm install)
  ok "Dependencies installed"
  summary_add "Dependencies: installed"
fi

# ---------------------------------------------------------------------------
# 6. Config profiles
# ---------------------------------------------------------------------------
section "Configuration"

if [[ ! -f "${DEV_ENV}" ]]; then
  warn "Dev profile not found at ${DEV_ENV} -- this is unexpected."
  warn "The repository should contain config/profiles/dev.env."
  summary_add "Config profile: dev.env missing (check repo)"
else
  ok "Dev profile exists: config/profiles/dev.env"
  summary_add "Config profile: config/profiles/dev.env"
fi

if [[ -f "${LOCAL_ENV}" ]]; then
  info ".env already exists at project root -- leaving it untouched"
  summary_add "Local .env: already present (kept as-is)"
else
  if [[ -f "${DEV_ENV}" ]]; then
    cp "${DEV_ENV}" "${LOCAL_ENV}"
    ok "Copied dev.env -> .env (safe-by-default dev settings)"
    summary_add "Local .env: created from dev.env"
  else
    warn "No dev.env to copy. Create .env manually or run openclaw setup."
    summary_add "Local .env: not created (no source profile)"
  fi
fi

# ---------------------------------------------------------------------------
# 7. Create ~/.openclaw directory if needed
# ---------------------------------------------------------------------------
OPENCLAW_HOME="${HOME}/.openclaw"
if [[ ! -d "${OPENCLAW_HOME}" ]]; then
  mkdir -p "${OPENCLAW_HOME}"
  ok "Created ${OPENCLAW_HOME}"
  summary_add "OpenClaw home: created ~/.openclaw"
else
  ok "OpenClaw home exists: ~/.openclaw"
  summary_add "OpenClaw home: ~/.openclaw (already exists)"
fi

# ---------------------------------------------------------------------------
# 8. Docker services (optional)
# ---------------------------------------------------------------------------
if [[ "${WITH_DOCKER}" -eq 1 ]]; then
  section "Docker Services"

  if [[ "${DOCKER_AVAILABLE}" -eq 0 ]]; then
    warn "Cannot start Docker services: Docker is not available or daemon is not running."
    summary_add "Docker services: skipped (Docker unavailable)"
  else
    COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
    if [[ -f "${COMPOSE_FILE}" ]]; then
      info "Starting Docker services from docker-compose.yml..."
      info "Note: you may need to set OPENCLAW_CONFIG_DIR, OPENCLAW_WORKSPACE_DIR,"
      info "and OPENCLAW_GATEWAY_TOKEN in your environment or .env file first."
      (cd "${ROOT_DIR}" && docker compose up -d 2>/dev/null) || {
        warn "Docker compose up failed. Check your .env for required variables."
        warn "Required: OPENCLAW_CONFIG_DIR, OPENCLAW_WORKSPACE_DIR, OPENCLAW_GATEWAY_TOKEN"
      }
      summary_add "Docker services: started (docker-compose.yml)"
    else
      warn "docker-compose.yml not found at project root"
      summary_add "Docker services: skipped (no compose file)"
    fi
  fi
else
  summary_add "Docker services: skipped (use --with-docker to start)"
fi

# ---------------------------------------------------------------------------
# 9. Print summary
# ---------------------------------------------------------------------------
section "Bootstrap Complete"

printf "${BOLD}Summary:${RESET}\n\n"
for item in "${SUMMARY_ITEMS[@]}"; do
  printf "  %s\n" "${item}"
done

printf "\n${BOLD}Next steps:${RESET}\n\n"
printf "  1. Review and edit ${CYAN}.env${RESET} if you need to customize settings\n"
printf "  2. Run the CLI in dev mode:\n"
printf "     ${CYAN}pnpm dev${RESET}\n"
printf "  3. Build the project:\n"
printf "     ${CYAN}pnpm build${RESET}\n"
printf "  4. Run tests:\n"
printf "     ${CYAN}pnpm test${RESET}\n"
printf "  5. Start the gateway:\n"
printf "     ${CYAN}pnpm openclaw gateway run${RESET}\n"
printf "\n"
printf "  For the full getting-started guide, see:\n"
printf "  ${CYAN}https://docs.openclaw.ai/clawdbot/getting-started${RESET}\n"
printf "\n"
