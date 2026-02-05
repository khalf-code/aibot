# Repository Guidelines

- Repo: https://github.com/openclaw/openclaw
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` (or $'...') for real newlines; never embed "\\n".

## Project Overview

**OpenClaw** is a personal AI assistant gateway that runs on your own devices. It provides a unified control plane for AI agents across multiple messaging channels including WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, Matrix, Zalo, and WebChat.

The project consists of:

- **Gateway**: WebSocket control plane for sessions, channels, tools, and events
- **CLI**: Command-line interface for configuration, messaging, and agent control
- **Pi Agent Runtime**: RPC-mode agent runtime with tool streaming and block streaming
- **Native Apps**: macOS menu bar app, iOS app, and Android app
- **Extensions**: 30+ plugin-based channel integrations and tools
- **Skills**: Reusable capability bundles (50+ built-in skills)

## Technology Stack

### Core Runtime

- **Node.js**: >=22.12.0 (required)
- **TypeScript**: 5.9+ with strict mode enabled
- **Package Manager**: pnpm 10.23.0 (with Bun support for dev/execution)
- **Module System**: ESM only (`"type": "module"`)

### Build Tools

- **Bundler**: tsdown (TypeScript to JavaScript)
- **Linting**: oxlint with type-aware checking
- **Formatting**: oxfmt
- **Swift**: SwiftLint + SwiftFormat for macOS/iOS apps

### Testing

- **Framework**: Vitest 4.x with V8 coverage
- **Coverage Thresholds**: 70% lines/functions/statements, 55% branches
- **Test Types**: Unit tests, E2E tests, Live tests (with real API keys)

### Native Apps

- **macOS**: Swift Package Manager, SwiftUI (Observation framework)
- **iOS**: XcodeGen, SwiftUI
- **Android**: Gradle 8.11.1, Kotlin, minSdk 24

### Key Dependencies

- **AI/LLM**: @mariozechner/pi-\* packages (agent core, AI, coding agent, TUI)
- **Messaging**: @whiskeysockets/baileys (WhatsApp), grammy (Telegram), @slack/bolt
- **Web**: hono (HTTP framework), express
- **Schema**: @sinclair/typebox, zod, ajv
- **Browser Automation**: playwright-core
- **Database**: sqlite-vec (vector search)

## Project Structure

```
openclaw/
├── src/                          # Main TypeScript source code
│   ├── cli/                      # CLI command implementations
│   ├── commands/                 # Command handlers
│   ├── agents/                   # AI agent runtime and tools
│   ├── gateway/                  # Gateway server implementation
│   ├── channels/                 # Channel plugin system
│   ├── discord/, telegram/, etc/ # Built-in channel implementations
│   ├── browser/                  # Browser automation
│   ├── auto-reply/               # Auto-reply and routing logic
│   ├── config/                   # Configuration management
│   ├── infra/                    # Infrastructure utilities
│   └── plugin-sdk/               # Plugin SDK for extensions
├── extensions/                   # Plugin-based extensions (30+)
│   ├── telegram/, discord/, etc/ # Channel extensions
│   ├── memory-*/                 # Memory backends
│   └── voice-call/               # Voice call extension
├── packages/                     # Workspace packages
│   ├── clawdbot/                 # Compatibility shim
│   └── moltbot/                  # Compatibility shim
├── apps/                         # Native applications
│   ├── macos/                    # macOS menu bar app (Swift)
│   ├── ios/                      # iOS app (Swift)
│   ├── android/                  # Android app (Kotlin)
│   └── shared/                   # Shared Swift code
├── ui/                           # Web UI (Vite + Lit)
├── skills/                       # Built-in skills (50+)
├── docs/                         # Documentation (Mintlify)
├── dist/                         # Compiled output
└── test/                         # Test utilities and setup
```

## Build and Development Commands

### Installation

```bash
# Install dependencies
pnpm install

# Enable pre-commit hooks
git config core.hooksPath git-hooks
# Or: prek install (if you have pre-commit installed)
```

### Development

```bash
# Run CLI in dev mode (TypeScript directly via tsx)
pnpm openclaw <command>
pnpm dev                    # Alias for above

# Gateway development
pnpm gateway:dev            # Run gateway with channel skip
pnpm gateway:watch          # Auto-reload on changes

# UI development
pnpm ui:dev                 # Start Vite dev server
pnpm ui:build               # Build production UI
```

### Building

```bash
# Full build (includes canvas bundle, copy operations)
pnpm build

# Individual steps
pnpm canvas:a2ui:bundle     # Bundle A2UI canvas components
```

### Platform-Specific

```bash
# macOS
pnpm mac:package            # Package macOS app
pnpm mac:restart            # Restart macOS gateway

# iOS
pnpm ios:gen                # Generate Xcode project
pnpm ios:run                # Build and run on simulator
pnpm ios:open               # Open in Xcode

# Android
pnpm android:assemble       # Build debug APK
pnpm android:install        # Install to device
pnpm android:run            # Build, install, and launch
pnpm android:test           # Run unit tests
```

## Testing

### Test Commands

```bash
pnpm test                   # Run unit tests (parallel)
pnpm test:watch             # Watch mode
pnpm test:coverage          # With coverage report

# E2E tests
pnpm test:e2e               # End-to-end tests
pnpm test:live              # Live tests (requires API keys)

# Docker-based tests
pnpm test:docker:all        # Run all Docker tests
pnpm test:docker:live-models
pnpm test:docker:live-gateway
pnpm test:docker:onboard
```

### Test Configuration

- **Unit tests**: `src/**/*.test.ts` (excludes `.live.test.ts`, `.e2e.test.ts`)
- **E2E tests**: `src/**/*.e2e.test.ts`
- **Live tests**: `src/**/*.live.test.ts` (requires real API keys)
- **Workers**: Auto-detected (max 16 local, 2-3 in CI)
- **Timeouts**: 120s test timeout, 120-180s hook timeout

### Environment Variables for Testing

```bash
# Live tests
CLAWDBOT_LIVE_TEST=1        # OpenClaw-only live tests
LIVE=1                      # Include provider live tests
OPENCLAW_LIVE_TEST=1        # OpenClaw live tests

# Docker live tests
CLAWDBOT_E2E_MODELS=anthropic|openai  # Specify model provider
```

## Code Style Guidelines

### TypeScript

- **Strict mode**: Enabled (no `any` without justification)
- **File size**: Keep files under ~500-700 LOC; split when feasible
- **Imports**: Use `.js` extensions for imports (NodeNext module resolution)
- **Comments**: Add brief comments for tricky or non-obvious logic
- **Naming**:
  - `OpenClaw` for product/app/docs headings
  - `openclaw` for CLI command, package/binary, paths, config keys

### Swift (macOS/iOS)

- **State Management**: Use `Observation` framework (`@Observable`, `@Bindable`)
- **Avoid**: `ObservableObject`/`@StateObject` unless required for compatibility
- **Linting**: SwiftLint with `.swiftlint.yml`
- **Formatting**: SwiftFormat with `.swiftformat`

### Linting and Formatting

```bash
pnpm check                  # Run all checks (tsgo + lint + format)
pnpm lint                   # oxlint --type-aware
pnpm lint:fix               # Auto-fix lint issues
pnpm format                 # Check formatting
pnpm format:fix             # Auto-fix formatting
pnpm format:swift           # Check Swift formatting
```

### Pre-commit Hooks

The project uses pre-commit hooks for:

- Trailing whitespace / end-of-file fixing
- YAML validation
- Large file checking
- Secret detection (detect-secrets)
- Shell script linting (shellcheck)
- GitHub Actions linting (actionlint)
- Security audit (zizmor)

## Security Considerations

### DM Access Defaults

OpenClaw connects to real messaging surfaces. Treat inbound DMs as **untrusted input**:

- **Default**: `dmPolicy="pairing"` - unknown senders receive a pairing code
- **Approval**: `openclaw pairing approve <channel> <code>`
- **Open DMs**: Requires explicit opt-in with `dmPolicy="open"` and `"*"` in allowlist

### Security Tools

```bash
# Run security checks
pnpm lint                   # Includes security linting

# Secret scanning (pre-commit and CI)
detect-secrets scan --baseline .secrets.baseline

# Run doctor to check risky configurations
openclaw doctor
```

### Credential Storage

- Web provider stores credentials at `~/.openclaw/credentials/`
- Pi sessions live under `~/.openclaw/sessions/`
- Use `openclaw login` to re-authenticate if logged out

### Never Commit

- Real phone numbers, videos, live configuration values
- API keys (use `.env.example` as template)
- Private keys or credentials

## Plugin and Extension Development

### Extension Structure

Extensions live in `extensions/*` as workspace packages:

```json
{
  "name": "@openclaw/my-extension",
  "type": "module",
  "devDependencies": {
    "openclaw": "workspace:*"
  },
  "openclaw": {
    "extensions": ["./index.ts"]
  }
}
```

### Plugin Installation

Plugins are installed with `npm install --omit=dev` in the plugin directory. Runtime deps must live in `dependencies`. Avoid `workspace:*` in `dependencies`.

### Adding Channels

When adding new channels, update:

1. Extension code in `extensions/<channel>/`
2. UI surfaces (macOS app, web UI, mobile if applicable)
3. Onboarding/overview docs
4. Status + configuration forms
5. `.github/labeler.yml` for label coverage

## Documentation

### Docs Structure

- **Location**: `docs/` (Mintlify format)
- **Links**: Use root-relative paths without `.md`/`.mdx` extensions
  - Correct: `[Config](/configuration)`
  - Anchors: `[Hooks](/configuration#hooks)`
- **Headings**: Avoid em dashes and apostrophes (break Mintlify anchors)
- **External URLs**: Use `https://docs.openclaw.ai/...` for README

### i18n (zh-CN)

- `docs/zh-CN/**` is auto-generated; do not edit directly
- Pipeline: Update English → adjust glossary → run `scripts/docs-i18n`
- See `docs/.i18n/README.md`

## Deployment

### Docker

```bash
# Build Docker image
docker build -t openclaw .

# Run with default config (binds to loopback)
docker run -p 18789:18789 openclaw

# Run with external access
docker run -e OPENCLAW_GATEWAY_TOKEN=<token> -p 18789:18789 openclaw node dist/index.js gateway --allow-unconfigured --bind lan
```

### NPM Release Channels

- **stable**: Tagged releases (`vYYYY.M.D`), npm dist-tag `latest`
- **beta**: Prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta`
- **dev**: Moving head on `main`, npm dist-tag `dev`

### Version Locations

When bumping versions, update:

- `package.json` (CLI version)
- `apps/android/app/build.gradle.kts` (versionName/versionCode)
- `apps/ios/Sources/Info.plist` + `Tests/Info.plist` (CFBundleShortVersionString/CFBundleVersion)
- `apps/macos/Sources/OpenClaw/Resources/Info.plist` (CFBundleShortVersionString/CFBundleVersion)
- `docs/install/updating.md` (pinned npm version)

## Troubleshooting

### Common Commands

```bash
# Diagnose issues
openclaw doctor

# Check gateway status
openclaw channels status --probe

# View logs
openclaw logs tail
./scripts/clawlog.sh        # macOS unified logs

# Reset/clean
pnpm test:docker:cleanup    # Clean Docker test containers
```

### Runtime Issues

- **Gateway restart**: Use macOS app or `scripts/restart-mac.sh`
- **Port conflicts**: Check `openclaw channels status` or `ss -ltnp | rg 18789`
- **Rebrand/migration**: Run `openclaw doctor` for legacy config warnings

## CI/CD

### GitHub Actions Workflows

- **ci.yml**: Main CI (TypeScript compilation, linting, testing on Ubuntu/macOS/Windows)
- **docker-release.yml**: Docker image builds
- **install-smoke.yml**: Installation script testing
- **labeler.yml**: PR label automation
- **workflow-sanity.yml**: Workflow validation

### CI Platforms

- **Linux**: Blacksmith 4-vCPU Ubuntu 24.04
- **macOS**: macos-latest (Xcode 26.1)
- **Windows**: Blacksmith 4-vCPU Windows 2025

## Multi-Agent Safety

When working alongside other agents:

- **Do not** create/apply/drop git stash entries unless requested
- **Do not** switch branches unless explicitly requested
- **Do not** create/remove/modify git worktrees
- Focus reports on your edits; avoid guard-rail disclaimers
- Commit only your changes; use `git pull --rebase` to integrate latest

## Release Checklist

Before releases, read:

- `docs/reference/RELEASING.md`
- `docs/platforms/mac/release.md` (for macOS app)

Do not change version numbers without operator's explicit consent.

## Gateway UI (Control UI)

The Gateway provides a web-based control UI at `http://localhost:18789/` (default port). The UI is built with Vite + Lit and provides real-time management of channels, agents, models, and configuration.

### Models Management Tab

The **Models** tab (Settings → Models) provides a unified interface for managing AI providers and local models:

#### Features

- **Cloud Providers**: Add, test, and manage API-based providers (OpenAI, Anthropic, etc.)
- **Preset Configurations**: One-click setup for popular providers with pre-configured models
- **Local Models**: Discover and pull Ollama models running locally
- **Model Testing**: Live connection testing with latency and throughput metrics
- **Model Selection**: Set default models and test individual models after adding a provider
- **Recommended Models**: Curated model recommendations optimized for M3 Max 36GB
- **Auto-load**: Tab automatically loads provider and model data when opened

#### File Structure

```
ui/src/ui/
├── types.models.ts          # TypeScript types for Models UI
├── controllers/
│   └── models.ts            # Models state management and API calls
├── views/
│   └── models.ts            # Models UI view component
├── app-settings.ts          # Tab switching with auto-load logic
├── navigation.ts            # Tab navigation (includes "models" tab)
├── icons.ts                 # Icon definitions (includes "cpu" icon)
├── app.ts                   # Main app component with models state
└── app-render.ts            # Renders models tab

src/gateway/server-methods/
└── models.ts                # Gateway RPC handlers for models

src/agents/
└── models-config.providers.ts  # Ollama auto-discovery logic
```

#### Gateway RPC Methods

| Method                     | Description                                                             |
| -------------------------- | ----------------------------------------------------------------------- |
| `models.list`              | List all available models from catalog                                  |
| `models.status`            | Get full models status (providers, ollama, default, heartbeat, allowed) |
| `models.test`              | Test a specific model with inference                                    |
| `models.testProvider`      | Test provider connectivity                                              |
| `models.discoverLocal`     | Discover local Ollama models                                            |
| `models.pullLocal`         | Pull a new Ollama model                                                 |
| `models.setDefault`        | Set the default model                                                   |
| `models.setHeartbeatModel` | Set the dedicated heartbeat model (separate from main model)            |
| `models.addProvider`       | Add a new cloud provider (supports preset models)                       |
| `models.removeProvider`    | Remove a provider                                                       |
| `models.listAllowed`       | List models in the allowlist                                            |
| `models.addAllowed`        | Add a model to the allowlist                                            |
| `models.removeAllowed`     | Remove a model from the allowlist                                       |
| `models.setAllowAll`       | Toggle allowAny mode (all models vs restricted)                         |

#### Preset Provider Configurations

The UI includes preset configurations for popular providers. When you select a preset:

1. Provider ID, name, and base URL are auto-filled
2. Popular models are pre-configured with correct pricing and capabilities
3. API key documentation opens in a new tab
4. Just paste your API key and click "Add Provider"

**Supported presets (Updated 2026-02-05):**

- **OpenAI**: GPT-5 (272K ctx), GPT-5.2 (latest), GPT-4.1 (legacy, 1M ctx), GPT-4.1 Mini (legacy), Codex, o3, o1, GPT-4o
- **Anthropic**: Claude Opus 4.5 ($5/$25), Sonnet 4.5 ($3/$15), Haiku 4.5 ($1/$5)
- **Google (Gemini)**: Gemini 3 Pro (1M ctx, multimodal), Gemini 3 Pro Long, Gemini 3 Flash
- **OpenRouter**: GPT-5, Claude Opus 4.5, Gemini 3 Pro, Llama 3.3 70B, DeepSeek V3
- **Groq**: Llama 3.3 70B (500+ tok/s), DeepSeek R1 Distill (300+ tok/s), Mixtral 8x7B (800+ tok/s), Llama 3.1 8B (1000+ tok/s)
- **Kimi (Moonshot AI)**: Kimi K2.5 (256K ctx), K2.5 1M (1M ctx), K2.5 32K/128K, K2 Code (coding optimized)

#### Ollama Integration

The Models UI integrates with Ollama for local model management:

1. **Auto-discovery**: Detects Ollama at `http://127.0.0.1:11434` automatically
2. **Model listing**: Shows installed models with size and parameters
3. **One-click pull**: Pull recommended models directly from the UI
4. **Context window**: Configures extended context (32K-128K) for local models

**Setup Ollama on macOS (Updated 2026-02-05):**

```bash
# Install
brew install ollama

# Start server
ollama serve

# Pull recommended models for M3 Max 36GB
# Lightweight tier - fast, minimal resources
ollama pull llama3.2:3b           # Fast heartbeat/checks (~50 tok/s)
ollama pull gemma3:4b             # Vision capable, ultra-fast (~50 tok/s)

# Balanced tier - good quality, reasonable speed
ollama pull llama3.3:8b           # Daily tasks, quick questions (~35 tok/s)
ollama pull qwen2.5-coder:7b      # Quick coding, scripts (~30 tok/s)
ollama pull deepseek-coder-v2:16b # Fast coding with MoE (~20 tok/s)
ollama pull phi4:14b              # Best reasoning & logic (~15 tok/s)

# High-performance tier - best quality, larger models
ollama pull qwen2.5-coder:32b     # Best coding - GPT-4o level (~9-14 tok/s, 20GB)
ollama pull qwen3:30b             # MoE architecture (~20-40 tok/s, 18GB)
```

**Model Resolution Fix (2025-02-04):**
Fixed an issue where Ollama models would fail with "Unknown model: ollama/<model>" error when the model wasn't explicitly configured in `models.json` or the config file. The fix adds fallback model creation for Ollama provider in `src/agents/pi-embedded-runner/model.ts`:

- Detects when provider is "ollama" (case-insensitive via `normalizeProviderId`)
- Creates a fallback model with correct `openai-completions` API type
- Uses default Ollama base URL `http://127.0.0.1:11434/v1`
- Allows any Ollama model to be used without prior configuration

**Auth Fix (2025-02-04):**
Fixed "No API key found for provider 'ollama'" error. Ollama is a local provider that doesn't require authentication, but the auth system was expecting an API key. The fix adds a "none" auth mode for Ollama:

- Added "none" to `ResolvedProviderAuth` mode type in `src/agents/model-auth.ts`
- Returns `{ mode: "none", source: "local-provider" }` for Ollama in `resolveApiKeyForProvider()`
- Updated `run.ts` and `compact.ts` to skip API key validation when mode is "none"
- Sets a dummy runtime API key (`"dummy-local-provider-key"`) for Ollama to satisfy the pi-coding-agent library's internal auth requirements

**Files modified:**

- `src/agents/models-config.providers.ts`: Export `OLLAMA_BASE_URL` constant
- `src/agents/pi-embedded-runner/model.ts`: Add Ollama fallback logic in `resolveModel()`
- `src/agents/model-auth.ts`: Add "none" auth mode and Ollama exception
- `src/agents/pi-embedded-runner/run.ts`: Handle "none" auth mode
- `src/agents/pi-embedded-runner/compact.ts`: Handle "none" auth mode

#### Token Optimization (Updated 2026-02-05)

The Models UI implements recommendations from the Token Optimization Guide for M3 Max 36GB:

**Workflow Recommendations:**

- **Heartbeat tasks**: Route to `gemma3:4b` or `llama3.2:3b` (local, ~50 tok/s, free)
- **Daily coding**: `qwen2.5-coder:32b` (primary) or `gpt-5` (complex architecture)
- **Quick edits**: `deepseek-coder-v2:16b` (local MoE, ~20 tok/s) or Groq Llama 3.3 70B (cloud, 500+ tok/s)
- **Complex debugging**: Start with `qwen3:30b` (local), escalate to `claude-opus-4.5` (cloud) if stuck
- **Math/reasoning**: `phi4:14b` (local, ~15 tok/s) or `claude-sonnet-4.5` (cloud)
- **Document analysis (large)**: `gemini-3-pro` (cloud, 1M context)
- **Multimodal**: `gemma3:4b` (local, vision) or `gpt-5`/`gemini-3-pro` (cloud)

**Cost Optimization:**

- **$5/day budget**: Use local 32B for 90% of tasks, cloud only for complex debugging
- **$20/day budget**: Mix local 32B + Claude Opus 4.5 for architecture
- **API key not required**: Ollama local models (completely free)

**Speed Priorities:**

- Fastest local: `gemma3:4b` (~50 tok/s)
- Fastest coding local: `deepseek-coder-v2:16b` (~20 tok/s MoE)
- Fastest cloud: Groq Llama 3.1 8B (1000+ tok/s)
- Best quality local: `qwen2.5-coder:32b` (GPT-4o level)
- Best quality cloud: `claude-opus-4.5` or `gpt-5`

#### Heartbeat Model Configuration

The Models UI includes a dedicated **Heartbeat** section for configuring the heartbeat model separately from the main model:

**Features:**

- **Separate Configuration**: Set a lightweight local model (e.g., `ollama/llama3.2:3b`) for heartbeats while keeping a powerful cloud model for main tasks
- **Cost Savings**: Route 1,440+ daily heartbeat checks to free local models instead of paid APIs
- **One-Click Setup**: Select from recommended heartbeat-optimized models
- **Visual Indicators**: See current heartbeat model status and estimated cost savings

**Recommended Heartbeat Models:**

- **Ultra-light**: `ollama/llama3.2:1b` (~100 tok/s, minimal RAM)
- **Fast**: `ollama/llama3.2:3b` (~50 tok/s, 2GB RAM) - Recommended
- **Vision**: `ollama/gemma3:4b` (~50 tok/s, vision capable)

**Configuration via UI:**

1. Go to Settings → Models → Heartbeat
2. Select a lightweight local model from the dropdown
3. The heartbeat model is saved independently from the default model

**Configuration via Config File:**

```json
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "model": "ollama/llama3.2:3b",
        "every": "30m"
      }
    }
  }
}
```

**Cost Impact:**
| Setup | Monthly Cost |
|-------|-------------|
| Heartbeats on cloud API | $5-15/month |
| Heartbeats on Ollama local | $0/month |

- **Model testing**: Verify connectivity before use

#### Allowed Models Configuration

The **Allowed Models** tab lets you control which models the brain agent can use for sub-agent tasks:

**Features:**

- **Allow All Toggle**: When enabled, the agent can use any available model. When disabled, only explicitly allowed models can be used.
- **Model List**: Shows all available models from configured providers and Ollama
- **Add/Remove**: Toggle individual models in/out of the allowlist
- **Visual Indicators**:
  - Default model is marked with a green "DEFAULT" badge
  - Allowed models show "ALLOWED" (or "BLOCKED" when restricted)
  - Local Ollama models are labeled

**Configuration via Config File:**

```json
{
  "agents": {
    "defaults": {
      "models": {
        "anthropic/claude-opus-4.5": { "alias": "opus" },
        "anthropic/claude-sonnet-4.5": { "alias": "sonnet" },
        "ollama/llama3.2:3b": { "alias": "fast-local" },
        "ollama/qwen2.5-coder:32b": { "alias": "coder" }
      }
    }
  }
}
```

**Empty allowlist means "allow all"** - this is the default behavior for flexibility.

**Agent Tool: `models_list`**

The agent can discover available models via the `models_list` tool:

```typescript
// List all allowed models (default)
models_list({ filter: "allowed" });

// List all discovered models
models_list({ filter: "all" });

// Get just the primary model
models_list({ filter: "primary" });
```

Response includes:

- `primary`: The current default model
- `allowAny`: Whether all models are allowed
- `models`: Array of model objects with `ref`, `name`, `provider`, `vision`, `isPrimary`, `isAllowed`

**Using with sessions_spawn:**

```typescript
// Discover available models
const models = await models_list({ filter: "allowed" });

// Spawn a sub-agent with a specific model
sessions_spawn({
  task: "Refactor this function to use async/await",
  model: "ollama/qwen2.5-coder:32b", // Use fast local model
  label: "code-refactor",
});

// For complex architecture, use a powerful model
sessions_spawn({
  task: "Design the database schema for a multi-tenant SaaS",
  model: "anthropic/claude-opus-4.5", // Use best reasoning model
  label: "architecture-design",
});
```

#### UI State Management

The models state is managed through the controller pattern:

```typescript
// In app.ts
@state() modelsLoading = false;
@state() modelsProviders: ModelProviderUiEntry[] = [];
@state() modelsOllamaAvailable = false;
@state() modelsOllamaModels: OllamaModelUiEntry[] = [];
@state() modelsDefaultModel = "";
@state() modelsHeartbeatModel = "";  // Separate heartbeat model
@state() modelsActiveTab: "providers" | "local" | "recommended" | "heartbeat" = "providers";
```

Actions are handled via methods in `app.ts` and implemented in `controllers/models.ts`.

#### Auto-Load Implementation

The Models tab auto-loads data when opened via the `refreshActiveTab` function in `app-settings.ts`:

```typescript
// In refreshActiveTab()
if (host.tab === "models") {
  await loadModelsStatus(host as unknown as OpenClawApp);
}
```

This ensures providers, Ollama models, and heartbeat configuration are loaded immediately when navigating to the tab, without requiring a manual refresh.

#### File Structure (Updated)

```
ui/src/ui/
├── types.models.ts          # TypeScript types for Models UI (includes heartbeat and allowed types)
├── controllers/
│   └── models.ts            # Models state management and API calls (includes heartbeat and allowed methods)
├── views/
│   └── models.ts            # Models UI view component (includes heartbeat and allowed tabs)
├── app-settings.ts          # Tab switching with auto-load logic
├── navigation.ts            # Tab navigation (includes "models" tab)
├── icons.ts                 # Icon definitions (includes "cpu", "heart" icons)
├── app.ts                   # Main app component with models, heartbeat, and allowed models state
└── app-render.ts            # Renders models tab

src/gateway/server-methods/
└── models.ts                # Gateway RPC handlers for models (includes setHeartbeatModel and allowed models)

src/agents/
├── models-config.providers.ts  # Ollama auto-discovery logic
└── tools/
    └── models-list-tool.ts     # Agent tool to discover available models
```

#### Build Commands

```bash
# Build UI only
pnpm ui:build

# Full build (includes UI)
pnpm build

# Dev mode with UI
pnpm ui:dev
```

### Agent Status Indicator

The chat interface features an animated "alive" agent status indicator (`<agent-status>`) that displays:

- **Current Status**: Shows whether the agent is idle (green), working/thinking/streaming (animated red pulse)
- **Token Usage**: Visual progress bar showing tokens used vs available context window
- **Current Model**: Displays the active model name with an icon
- **Animated Effects**:
  - Pulsing rings when the agent is active
  - Rotating loader icon during work
  - Gradient shimmer effect on the token bar
  - Smooth transitions and hover effects

**Component Location**: `ui/src/ui/components/agent-status.ts`

**Usage in Chat**: The component is automatically rendered at the top of the chat interface, pulling data from the active session:

- Status is derived from `chatSending`, `chatStream`, and `chatRunId` states
- Token counts come from session data (`totalTokens`, `contextTokens`)
- Model info comes from session's `model` field

**Props**:

```typescript
@property({ type: String }) status: AgentStatusType = "idle";  // idle | working | thinking | streaming
@property({ type: Number }) tokens = 0;                          // Current tokens used
@property({ type: Number }) maxTokens = 0;                       // Max context window
@property({ type: String }) model = "";                          // Model name
@property({ type: Boolean }) connected = false;                  // Connection state
@property({ type: String }) assistantName = "Agent";             // Display name
```

Do not change version numbers without operator's explicit consent.
