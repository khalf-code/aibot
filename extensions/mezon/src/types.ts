export type MezonAccountConfig = {
  /** Optional display name for this account (used in CLI/UI lists). */
  name?: string;
  /** If false, do not start this Mezon account. Default: true. */
  enabled?: boolean;
  /** Bot ID from Mezon Developer Portal. */
  botId?: string;
  /** Bot token from Mezon Developer Portal. */
  botToken?: string;
  /** Path to file containing the bot token. */
  tokenFile?: string;
  /** Direct message access policy (default: pairing). */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  /** Allowlist for DM senders (Mezon user IDs). */
  allowFrom?: Array<string | number>;
  /** Max inbound media size in MB. */
  mediaMaxMb?: number;
  /** Mezon gateway host (default: gw.mezon.ai). */
  host?: string;
  /** Mezon gateway port (default: 443). */
  port?: string;
  /** Use SSL for connection (default: true). */
  useSSL?: boolean;
};

export type MezonConfig = {
  /** Optional per-account Mezon configuration (multi-account). */
  accounts?: Record<string, MezonAccountConfig>;
  /** Default account ID when multiple accounts are configured. */
  defaultAccount?: string;
} & MezonAccountConfig;

export type MezonTokenSource = "env" | "config" | "configFile" | "none";

export type ResolvedMezonAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  botId: string;
  token: string;
  tokenSource: MezonTokenSource;
  config: MezonAccountConfig;
};

/** Bot info returned from Mezon API. */
export type MezonBotInfo = {
  id: string;
  username?: string;
  display_name?: string;
  avatar?: string;
};

export enum MezonMessageMode {
  DIRECT_MESSAGE = 4,
  CHANNEL_MESSAGE = 2
}