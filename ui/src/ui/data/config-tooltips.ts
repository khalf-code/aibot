/**
 * Comprehensive config tooltips with descriptions, doc links, and recommendations.
 * This data powers the tooltip UI for all config fields.
 */
import type { ConfigUiHint } from "../types.ts";

const DOCS_BASE = "https://docs.openclaw.ai";

/**
 * Config tooltips indexed by config path (dot notation).
 * Supports wildcards (*) for dynamic paths like channels.*.allowFrom
 */
export const CONFIG_TOOLTIPS: Record<string, ConfigUiHint> = {
  // ============================================
  // Agents
  // ============================================
  agents: {
    label: "Agents",
    help: "Configure AI agents, their workspaces, models, and behavior.",
    docUrl: `${DOCS_BASE}/concepts/agent`,
    recommendation:
      "Start with a single 'main' agent. Add more agents for different personas or use cases.",
  },
  "agents.defaults": {
    label: "Agent Defaults",
    help: "Default settings applied to all agents unless overridden.",
    docUrl: `${DOCS_BASE}/concepts/agent`,
  },
  "agents.defaults.workspace": {
    label: "Default Workspace",
    help: "Base directory for agent files (AGENTS.md, SOUL.md, etc.). Supports ~ for home directory.",
    docUrl: `${DOCS_BASE}/concepts/agent-workspace`,
    recommendation: "Use ~/.openclaw/workspace for the default agent.",
    placeholder: "~/.openclaw/workspace",
  },
  "agents.defaults.model": {
    label: "Default Model",
    help: "Primary AI model for all agents. Format: provider/model-name (e.g., anthropic/claude-sonnet-4-5).",
    docUrl: `${DOCS_BASE}/concepts/models`,
    recommendation: "claude-sonnet-4-5 offers the best balance of capability and speed.",
  },
  "agents.defaults.timeoutSeconds": {
    label: "Timeout",
    help: "Maximum time (seconds) for a single agent turn before it's cancelled.",
    recommendation: "600 seconds (10 min) is a good default. Increase for complex tasks.",
  },
  "agents.defaults.maxConcurrent": {
    label: "Max Concurrent",
    help: "Maximum number of agent turns that can run simultaneously.",
    recommendation: "1-3 for personal use. Higher values increase API costs.",
  },
  "agents.list": {
    label: "Agent List",
    help: "Define multiple agents with different configurations, models, or personas.",
    docUrl: `${DOCS_BASE}/concepts/multi-agent`,
    recommendation:
      "Each agent needs a unique 'id'. The first agent or one with 'default: true' is the default.",
  },
  "agents.list.*.id": {
    label: "Agent ID",
    help: "Unique identifier for this agent. Used in routing and CLI commands.",
    recommendation: "Use short, descriptive names like 'main', 'coding', 'chat'.",
  },
  "agents.list.*.model": {
    label: "Model",
    help: "AI model for this agent. Overrides agents.defaults.model.",
    docUrl: `${DOCS_BASE}/concepts/models`,
  },
  "agents.list.*.workspace": {
    label: "Workspace",
    help: "Workspace directory for this agent. Overrides agents.defaults.workspace.",
    docUrl: `${DOCS_BASE}/concepts/agent-workspace`,
  },
  "agents.list.*.identity": {
    label: "Identity",
    help: "Agent's display name, emoji, and avatar for UI and messages.",
    docUrl: `${DOCS_BASE}/concepts/agent`,
  },
  "agents.list.*.identity.name": {
    label: "Display Name",
    help: "Human-readable name shown in UI and message headers.",
  },
  "agents.list.*.identity.emoji": {
    label: "Emoji",
    help: "Single emoji representing this agent in compact views.",
  },
  "agents.list.*.identity.avatar": {
    label: "Avatar",
    help: "URL, data URI, or workspace-relative path to avatar image.",
  },
  "agents.list.*.tools": {
    label: "Tool Policy",
    help: "Control which tools this agent can use (read, write, exec, etc.).",
    docUrl: `${DOCS_BASE}/gateway/sandbox-vs-tool-policy-vs-elevated`,
  },
  "agents.list.*.skills": {
    label: "Skills Allowlist",
    help: "List of skill names this agent can use. If set, all others are disabled.",
    docUrl: `${DOCS_BASE}/tools/skills-config`,
  },

  // ============================================
  // Gateway
  // ============================================
  gateway: {
    label: "Gateway",
    help: "HTTP server settings, authentication, and remote access configuration.",
    docUrl: `${DOCS_BASE}/gateway/configuration`,
  },
  "gateway.port": {
    label: "Port",
    help: "TCP port for the Gateway HTTP/WebSocket server.",
    recommendation: "18789 is the default. Change if you have port conflicts.",
    placeholder: "18789",
  },
  "gateway.bind": {
    label: "Bind Address",
    help: "Network interface to bind to. 'loopback' for local only, '0.0.0.0' for all interfaces.",
    docUrl: `${DOCS_BASE}/gateway/remote`,
    recommendation: "Use 'loopback' unless you need remote access. For remote, use Tailscale.",
  },
  "gateway.mode": {
    label: "Mode",
    help: "Gateway operation mode: 'local' runs embedded, 'remote' connects to another gateway.",
    recommendation: "Use 'local' for most setups.",
  },
  "gateway.auth": {
    label: "Authentication",
    help: "Token or password authentication for Gateway access.",
    docUrl: `${DOCS_BASE}/gateway/security/index`,
  },
  "gateway.auth.token": {
    label: "Auth Token",
    help: "Bearer token for API authentication. Required if binding beyond loopback.",
    docUrl: `${DOCS_BASE}/gateway/security/index`,
    recommendation: "Generate a long random string (32+ chars). Keep it secret!",
    sensitive: true,
  },
  "gateway.auth.password": {
    label: "Password",
    help: "Password for Control UI login. Alternative to token auth.",
    sensitive: true,
  },
  "gateway.tls": {
    label: "TLS",
    help: "HTTPS/WSS configuration with auto-generated or custom certificates.",
    docUrl: `${DOCS_BASE}/gateway/remote`,
  },
  "gateway.tailscale": {
    label: "Tailscale",
    help: "Expose Gateway via Tailscale Serve or Funnel for secure remote access.",
    docUrl: `${DOCS_BASE}/gateway/tailscale`,
    recommendation:
      "Use 'serve' for Tailnet-only access. 'funnel' exposes to public internet (use with caution).",
  },

  // ============================================
  // Channels
  // ============================================
  channels: {
    label: "Channels",
    help: "Configure messaging platform integrations (WhatsApp, Telegram, Discord, etc.).",
    docUrl: `${DOCS_BASE}/channels/whatsapp`,
  },
  "channels.whatsapp": {
    label: "WhatsApp",
    help: "WhatsApp Web integration using Baileys library.",
    docUrl: `${DOCS_BASE}/channels/whatsapp`,
  },
  "channels.whatsapp.enabled": {
    label: "Enabled",
    help: "Enable or disable WhatsApp integration.",
  },
  "channels.whatsapp.allowFrom": {
    label: "Allow From",
    help: "Phone numbers (E.164 format) allowed to message the bot. Empty = block all DMs.",
    docUrl: `${DOCS_BASE}/channels/whatsapp`,
    recommendation: "Add your phone number to enable self-chat mode.",
    placeholder: "+15555550123",
  },
  "channels.whatsapp.groups": {
    label: "Groups",
    help: "Configure group chat behavior per group or globally with '*'.",
    docUrl: `${DOCS_BASE}/concepts/groups`,
  },
  "channels.whatsapp.groups.*.requireMention": {
    label: "Require Mention",
    help: "Only respond when the bot is @-mentioned in this group.",
    recommendation: "Enable in busy groups to reduce noise.",
  },
  "channels.telegram": {
    label: "Telegram",
    help: "Telegram Bot API integration using grammY.",
    docUrl: `${DOCS_BASE}/channels/telegram`,
  },
  "channels.telegram.token": {
    label: "Bot Token",
    help: "Telegram Bot token from @BotFather.",
    docUrl: `${DOCS_BASE}/channels/telegram`,
    sensitive: true,
  },
  "channels.telegram.allowFrom": {
    label: "Allow From",
    help: "Telegram user IDs or usernames allowed to message the bot.",
  },
  "channels.discord": {
    label: "Discord",
    help: "Discord Bot integration.",
    docUrl: `${DOCS_BASE}/channels/discord`,
  },
  "channels.discord.token": {
    label: "Bot Token",
    help: "Discord Bot token from Developer Portal.",
    docUrl: `${DOCS_BASE}/channels/discord`,
    sensitive: true,
  },
  "channels.discord.guilds": {
    label: "Guilds",
    help: "Per-server (guild) configuration for channels, mentions, and allowlists.",
    docUrl: `${DOCS_BASE}/channels/discord`,
  },
  "channels.slack": {
    label: "Slack",
    help: "Slack App integration using Bolt.",
    docUrl: `${DOCS_BASE}/channels/slack`,
  },
  "channels.signal": {
    label: "Signal",
    help: "Signal Messenger integration.",
    docUrl: `${DOCS_BASE}/channels/signal`,
  },
  "channels.imessage": {
    label: "iMessage",
    help: "iMessage integration (macOS only, requires Messages.app access).",
    docUrl: `${DOCS_BASE}/channels/imessage`,
  },

  // ============================================
  // Auth / Models
  // ============================================
  auth: {
    label: "Authentication",
    help: "API keys and OAuth tokens for AI model providers.",
    docUrl: `${DOCS_BASE}/providers/index`,
  },
  "auth.profiles": {
    label: "Auth Profiles",
    help: "Named authentication profiles for different providers or accounts.",
    docUrl: `${DOCS_BASE}/concepts/model-failover`,
    recommendation: "Create multiple profiles for failover between providers.",
  },
  "auth.profiles.*.provider": {
    label: "Provider",
    help: "AI provider for this profile (anthropic, openai, google, etc.).",
    docUrl: `${DOCS_BASE}/providers/index`,
  },
  "auth.profiles.*.mode": {
    label: "Auth Mode",
    help: "'api_key' for direct API access, 'oauth' for OAuth tokens.",
  },
  "auth.profiles.*.apiKey": {
    label: "API Key",
    help: "API key for this provider. Keep this secret!",
    sensitive: true,
  },
  "auth.order": {
    label: "Profile Order",
    help: "Failover order for auth profiles per provider.",
    docUrl: `${DOCS_BASE}/concepts/model-failover`,
  },
  models: {
    label: "Models",
    help: "Model definitions, aliases, and custom configurations.",
    docUrl: `${DOCS_BASE}/concepts/models`,
  },
  "models.aliases": {
    label: "Model Aliases",
    help: "Short names that map to full model IDs (e.g., 'opus' -> 'anthropic/claude-opus-4-5').",
    recommendation: "Use aliases to simplify config and enable easy model switching.",
  },

  // ============================================
  // Messages
  // ============================================
  messages: {
    label: "Messages",
    help: "Message formatting, prefixes, and queue behavior.",
    docUrl: `${DOCS_BASE}/concepts/messages`,
  },
  "messages.prefix": {
    label: "Message Prefix",
    help: "Text prepended to all agent responses.",
  },
  "messages.suffix": {
    label: "Message Suffix",
    help: "Text appended to all agent responses.",
  },
  "messages.queue": {
    label: "Message Queue",
    help: "How incoming messages are queued and processed.",
    docUrl: `${DOCS_BASE}/concepts/queue`,
  },
  "messages.queue.mode": {
    label: "Queue Mode",
    help: "'collect' batches messages, 'followup' processes one-by-one, 'steer' interrupts current turn.",
    docUrl: `${DOCS_BASE}/concepts/queue`,
    recommendation: "'collect' with debounce works well for most use cases.",
  },
  "messages.queue.debounceMs": {
    label: "Debounce (ms)",
    help: "Wait this long after last message before starting agent turn.",
    recommendation: "1000-2000ms allows users to finish typing.",
  },

  // ============================================
  // Session
  // ============================================
  session: {
    label: "Session",
    help: "Session management, pruning, and storage settings.",
    docUrl: `${DOCS_BASE}/concepts/session`,
  },
  "session.collapseDMs": {
    label: "Collapse DMs",
    help: "Merge DM sessions into the agent's main session.",
    docUrl: `${DOCS_BASE}/concepts/session`,
  },
  "session.pruning": {
    label: "Pruning",
    help: "Automatic session history management to control context size.",
    docUrl: `${DOCS_BASE}/concepts/session-pruning`,
  },
  "session.compaction": {
    label: "Compaction",
    help: "Summarize and compress old session history.",
    docUrl: `${DOCS_BASE}/reference/session-management-compaction`,
  },

  // ============================================
  // Logging
  // ============================================
  logging: {
    label: "Logging",
    help: "Log output, verbosity, and sensitive data redaction.",
    docUrl: `${DOCS_BASE}/logging`,
  },
  "logging.level": {
    label: "Log Level",
    help: "Minimum severity to log: debug, info, warn, error.",
    recommendation: "'info' for normal use, 'debug' for troubleshooting.",
  },
  "logging.redactSensitive": {
    label: "Redact Sensitive",
    help: "Redact sensitive data from logs: 'off', 'tools', 'all'.",
    docUrl: `${DOCS_BASE}/logging`,
    recommendation: "Enable 'tools' to redact tool call parameters in logs.",
  },

  // ============================================
  // Skills
  // ============================================
  skills: {
    label: "Skills",
    help: "Skill configuration and allowlists.",
    docUrl: `${DOCS_BASE}/tools/skills`,
  },
  "skills.allowFrom": {
    label: "Allow From",
    help: "Sources allowed to install/run skills: workspace, managed, bundled.",
    docUrl: `${DOCS_BASE}/tools/skills-config`,
  },

  // ============================================
  // Plugins
  // ============================================
  plugins: {
    label: "Plugins",
    help: "Extension plugins for additional channels or features.",
    docUrl: `${DOCS_BASE}/plugin`,
  },
  "plugins.enabled": {
    label: "Enabled Plugins",
    help: "List of plugin package names to load.",
    docUrl: `${DOCS_BASE}/plugin`,
  },

  // ============================================
  // Hooks
  // ============================================
  hooks: {
    label: "Hooks",
    help: "Webhooks and automation triggers.",
    docUrl: `${DOCS_BASE}/hooks`,
  },
  "hooks.http": {
    label: "HTTP Webhooks",
    help: "HTTP endpoints to call on events.",
    docUrl: `${DOCS_BASE}/automation/webhook`,
  },

  // ============================================
  // Cron
  // ============================================
  cron: {
    label: "Cron Jobs",
    help: "Scheduled tasks that run on a timer.",
    docUrl: `${DOCS_BASE}/automation/cron-jobs`,
  },
  "cron.jobs": {
    label: "Jobs",
    help: "List of scheduled jobs with cron expressions and actions.",
    docUrl: `${DOCS_BASE}/automation/cron-jobs`,
  },

  // ============================================
  // Tools
  // ============================================
  tools: {
    label: "Tools",
    help: "Global tool access policies.",
    docUrl: `${DOCS_BASE}/tools/index`,
  },
  "tools.elevated": {
    label: "Elevated Tools",
    help: "Tools that require explicit approval before execution.",
    docUrl: `${DOCS_BASE}/tools/exec-approvals`,
  },

  // ============================================
  // Browser
  // ============================================
  browser: {
    label: "Browser",
    help: "Browser automation (Playwright) settings.",
    docUrl: `${DOCS_BASE}/tools/browser`,
  },
  "browser.enabled": {
    label: "Enabled",
    help: "Enable browser automation tool.",
  },
  "browser.headless": {
    label: "Headless",
    help: "Run browser without visible window.",
    recommendation: "Enable for server deployments, disable for debugging.",
  },

  // ============================================
  // Memory
  // ============================================
  memory: {
    label: "Memory",
    help: "Long-term memory and semantic search settings.",
    docUrl: `${DOCS_BASE}/concepts/memory`,
  },
  "memory.backend": {
    label: "Backend",
    help: "'builtin' uses SQLite-vec, 'qmd' uses external qmd command.",
  },
  "memory.citations": {
    label: "Citations",
    help: "Include source citations in memory search results.",
  },

  // ============================================
  // Discovery / Bonjour
  // ============================================
  discovery: {
    label: "Discovery",
    help: "mDNS/Bonjour service discovery for local network.",
    docUrl: `${DOCS_BASE}/gateway/bonjour`,
  },
  "discovery.enabled": {
    label: "Enabled",
    help: "Advertise Gateway on local network via mDNS.",
    docUrl: `${DOCS_BASE}/gateway/bonjour`,
  },

  // ============================================
  // Update
  // ============================================
  update: {
    label: "Updates",
    help: "Auto-update settings and release channel.",
  },
  "update.channel": {
    label: "Release Channel",
    help: "'stable' for releases, 'beta' for pre-releases, 'dev' for main branch.",
    recommendation: "Use 'stable' unless you want to test new features.",
  },
  "update.checkOnStart": {
    label: "Check on Start",
    help: "Check for updates when Gateway starts.",
  },

  // ============================================
  // Bindings
  // ============================================
  bindings: {
    label: "Agent Bindings",
    help: "Route messages to specific agents based on channel, account, or peer.",
    docUrl: `${DOCS_BASE}/concepts/multi-agent`,
    recommendation: "Most specific bindings (peer > guild > account > channel) take precedence.",
  },
};

/**
 * Get tooltip data for a config path.
 * Supports wildcards in path keys (e.g., agents.list.* matches agents.list.0, agents.list.main)
 */
export function getConfigTooltip(path: string): ConfigUiHint | undefined {
  // Direct match
  if (CONFIG_TOOLTIPS[path]) {
    return CONFIG_TOOLTIPS[path];
  }

  // Try wildcard matches
  const segments = path.split(".");
  for (const [key, hint] of Object.entries(CONFIG_TOOLTIPS)) {
    if (!key.includes("*")) {
      continue;
    }

    const keySegments = key.split(".");
    if (keySegments.length !== segments.length) {
      continue;
    }

    let match = true;
    for (let i = 0; i < segments.length; i++) {
      if (keySegments[i] !== "*" && keySegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return hint;
    }
  }

  return undefined;
}
