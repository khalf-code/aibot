/**
 * SMS Channel Plugin
 * Main channel implementation for Clawdbot
 */

import { configAdapter } from "./config.js";
import { gatewayAdapter } from "./gateway.js";
import { outboundAdapter } from "./outbound.js";
import type { SMSResolvedAccount } from "./types.js";

const CHANNEL_ID = "sms";

/**
 * Channel metadata for UI/docs
 */
const meta = {
  id: CHANNEL_ID,
  label: "SMS",
  selectionLabel: "SMS (Plivo/Twilio)",
  docsPath: "/channels/sms",
  docsLabel: "sms",
  blurb: "SMS/MMS messaging; universal phone access to your AI assistant.",
};

/**
 * Channel capabilities
 */
const capabilities = {
  supportsText: true,
  supportsMedia: true,
  supportsVoice: false,
  supportsVideo: false,
  supportsStickers: false,
  supportsPolls: false,
  supportsButtons: false,
  supportsFormatting: false, // SMS is plain text
  supportsThreading: false,
  supportsReactions: false,
  supportsEditing: false,
  supportsDeleting: false,
  maxTextLength: 1600, // SMS concatenation limit
  maxMediaSize: 5 * 1024 * 1024, // 5MB MMS limit
  maxMediaCount: 10,
};

/**
 * SMS channel plugin definition
 */
export const smsPlugin = {
  id: CHANNEL_ID,
  meta,
  capabilities,

  // Configuration adapter
  config: {
    listAccountIds: (cfg: { channels?: Record<string, unknown> }) =>
      configAdapter.listAccountIds(cfg),

    resolveAccount: (cfg: { channels?: Record<string, unknown> }, accountId?: string) =>
      configAdapter.resolveAccount(cfg, accountId),

    isConfigured: (cfg: { channels?: Record<string, unknown> }, accountId?: string) =>
      configAdapter.isConfigured(cfg, accountId),

    resolveAllowFrom: (cfg: { channels?: Record<string, unknown> }, accountId?: string) =>
      configAdapter.resolveAllowFrom(cfg, accountId),

    describeAccount: (cfg: { channels?: Record<string, unknown> }, accountId?: string) =>
      configAdapter.describeAccount(cfg, accountId),
  },

  // Gateway adapter for starting/stopping
  gateway: {
    startAccount: gatewayAdapter.startAccount,
    stopAccount: gatewayAdapter.stopAccount,
  },

  // Outbound adapter for sending messages
  outbound: {
    deliveryMode: outboundAdapter.deliveryMode,

    sendText: async (ctx: {
      to: string;
      text: string;
      accountId: string;
      account: SMSResolvedAccount;
    }) => {
      const result = await outboundAdapter.sendText({
        to: ctx.to,
        text: ctx.text,
        accountId: ctx.accountId,
        account: ctx.account,
      });
      return { ok: result.ok, externalId: result.externalId, error: result.error };
    },

    sendMedia: async (ctx: {
      to: string;
      text?: string;
      mediaUrl?: string;
      mediaUrls?: string[];
      accountId: string;
      account: SMSResolvedAccount;
    }) => {
      const result = await outboundAdapter.sendMedia({
        to: ctx.to,
        text: ctx.text,
        mediaUrl: ctx.mediaUrl,
        mediaUrls: ctx.mediaUrls,
        accountId: ctx.accountId,
        account: ctx.account,
      });
      return { ok: result.ok, externalId: result.externalId, error: result.error };
    },

    resolveTarget: (target: string) => outboundAdapter.resolveTarget(target),
  },

  // Status adapter for health checks
  status: {
    probeAccount: async (_ctx: { accountId: string }) => {
      return { ok: true, message: "SMS account is running" };
    },

    buildAccountSnapshot: (ctx: { accountId: string; account: SMSResolvedAccount }) => {
      return {
        accountId: ctx.accountId,
        provider: ctx.account.provider,
        phoneNumber: ctx.account.phoneNumber,
        dmPolicy: ctx.account.dmPolicy,
      };
    },
  },

  // Heartbeat adapter
  heartbeat: {
    checkReady: async (_params: { accountId: string }) => {
      return { ok: true, reason: "SMS ready" };
    },

    resolveRecipients: (params: { accountId: string; allowFrom: string[] }) => {
      return {
        recipients: params.allowFrom,
        source: "allowlist",
      };
    },
  },
};
