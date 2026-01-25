import { chunkText } from "../../../auto-reply/chunk.js";
import { shouldLogVerbose } from "../../../globals.js";
import { sendPollWhatsApp } from "../../../web/outbound.js";
import { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "../../../whatsapp/normalize.js";
import type { ChannelOutboundAdapter } from "../types.js";
import { missingTargetError } from "../../../infra/outbound/target-errors.js";

export const whatsappOutbound: ChannelOutboundAdapter = {
  deliveryMode: "gateway",
  chunker: chunkText,
  chunkerMode: "text",
  textChunkLimit: 4000,
  pollMaxOptions: 12,
  resolveTarget: ({ cfg, to, allowFrom, accountId, mode, allowUnlisted }) => {
    const trimmed = to?.trim() ?? "";
    const allowListRaw = (allowFrom ?? []).map((entry) => String(entry).trim()).filter(Boolean);
    const hasWildcard = allowListRaw.includes("*");
    const allowList = allowListRaw
      .filter((entry) => entry !== "*")
      .map((entry) => normalizeWhatsAppTarget(entry))
      .filter((entry): entry is string => Boolean(entry));

    // FIX-5: Resolve automation recipients for heartbeat/automation mode validation
    const isAutomationMode = mode === "heartbeat" || mode === "automation";
    let automationRecipientsConfigured = false;
    let automationRecipients: string[] = [];
    if (isAutomationMode && cfg) {
      const accountKey = accountId?.trim() || "default";
      const accountCfg = cfg.channels?.whatsapp?.accounts?.[accountKey];
      const accountAutomation = accountCfg?.automation?.recipients;
      const globalAutomation = cfg.channels?.whatsapp?.automation?.recipients;
      // Check if automation.recipients is explicitly configured at any level
      automationRecipientsConfigured =
        accountAutomation !== undefined || globalAutomation !== undefined;
      const rawRecipients = accountAutomation ?? globalAutomation ?? [];
      automationRecipients = rawRecipients
        .map((entry) => normalizeWhatsAppTarget(String(entry).trim()))
        .filter((entry): entry is string => Boolean(entry));
    }

    if (trimmed) {
      const normalizedTo = normalizeWhatsAppTarget(trimmed);
      if (!normalizedTo) {
        if ((mode === "implicit" || mode === "heartbeat") && allowList.length > 0) {
          return { ok: true, to: allowList[0] };
        }
        return {
          ok: false,
          error: missingTargetError(
            "WhatsApp",
            "<E.164|group JID> or channels.whatsapp.allowFrom[0]",
          ),
        };
      }
      // Groups are always allowed (no allowlist check needed)
      if (isWhatsAppGroupJid(normalizedTo)) {
        return { ok: true, to: normalizedTo };
      }

      // FIX-5: Validate automation recipients for heartbeat/automation sends
      if (isAutomationMode) {
        // If automation.recipients is configured, enforce it strictly
        if (automationRecipientsConfigured) {
          // If configured but empty, block ALL automation sends
          if (automationRecipients.length === 0) {
            // eslint-disable-next-line no-console
            console.error(
              `[security] Automation send to ${normalizedTo} blocked - automation.recipients is empty (no automation sends allowed)`,
            );
            return {
              ok: false,
              error: new Error(
                `Automation send to ${normalizedTo} blocked. automation.recipients is configured but empty, ` +
                  `meaning no automated sends are allowed. Add the target to automation.recipients to allow automated sends.`,
              ),
            };
          }
          // If configured and non-empty, validate against the list
          if (!automationRecipients.includes(normalizedTo)) {
            // eslint-disable-next-line no-console
            console.error(
              `[security] Automation send to ${normalizedTo} blocked - not in channels.whatsapp.automation.recipients`,
            );
            return {
              ok: false,
              error: new Error(
                `Automation send to ${normalizedTo} blocked. Target not in channels.whatsapp.automation.recipients. ` +
                  `Add the target to automation.recipients to allow automated sends.`,
              ),
            };
          }
          return { ok: true, to: normalizedTo };
        }
        // If automation.recipients is NOT configured (undefined), fall through to allowlist
        if (hasWildcard || allowList.length === 0) {
          return { ok: true, to: normalizedTo };
        }
        if (allowList.includes(normalizedTo)) {
          return { ok: true, to: normalizedTo };
        }
        return { ok: true, to: allowList[0] };
      }

      if (mode === "implicit") {
        if (hasWildcard || allowList.length === 0) {
          return { ok: true, to: normalizedTo };
        }
        if (allowList.includes(normalizedTo)) {
          return { ok: true, to: normalizedTo };
        }
        return { ok: true, to: allowList[0] };
      }
      // For explicit mode - validate allowlist unless override is set
      if (mode === "explicit") {
        // Wildcard or empty allowlist: allow any target
        if (hasWildcard || allowList.length === 0) {
          return { ok: true, to: normalizedTo };
        }
        // Target is in allowlist: allow
        if (allowList.includes(normalizedTo)) {
          return { ok: true, to: normalizedTo };
        }
        // Target not in allowlist: require explicit override
        if (allowUnlisted) {
          return { ok: true, to: normalizedTo };
        }
        return {
          ok: false,
          error: new Error(
            `Target ${normalizedTo} not in WhatsApp allowlist (channels.whatsapp.allowFrom). ` +
              `Add the target to your allowlist, or use --allow-unlisted to override.`,
          ),
        };
      }
      return { ok: true, to: normalizedTo };
    }

    if (allowList.length > 0) {
      return { ok: true, to: allowList[0] };
    }
    return {
      ok: false,
      error: missingTargetError("WhatsApp", "<E.164|group JID> or channels.whatsapp.allowFrom[0]"),
    };
  },
  sendText: async ({ to, text, accountId, deps, gifPlayback }) => {
    const send =
      deps?.sendWhatsApp ?? (await import("../../../web/outbound.js")).sendMessageWhatsApp;
    const result = await send(to, text, {
      verbose: false,
      accountId: accountId ?? undefined,
      gifPlayback,
    });
    return { channel: "whatsapp", ...result };
  },
  sendMedia: async ({ to, text, mediaUrl, accountId, deps, gifPlayback }) => {
    const send =
      deps?.sendWhatsApp ?? (await import("../../../web/outbound.js")).sendMessageWhatsApp;
    const result = await send(to, text, {
      verbose: false,
      mediaUrl,
      accountId: accountId ?? undefined,
      gifPlayback,
    });
    return { channel: "whatsapp", ...result };
  },
  sendPoll: async ({ to, poll, accountId }) =>
    await sendPollWhatsApp(to, poll, {
      verbose: shouldLogVerbose(),
      accountId: accountId ?? undefined,
    }),
};
