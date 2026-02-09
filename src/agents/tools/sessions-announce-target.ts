import type { AnnounceTarget } from "./sessions-send-helpers.js";
import { getChannelPlugin, normalizeChannelId } from "../../channels/plugins/index.js";
import { callGateway } from "../../gateway/call.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { isInternalMessageChannel } from "../../utils/message-channel.js";
import { resolveAnnounceTargetFromKey } from "./sessions-send-helpers.js";

const log = createSubsystemLogger("agents/announce-target");

export async function resolveAnnounceTarget(params: {
  sessionKey: string;
  displayKey: string;
  requesterSessionKey?: string;
  requesterChannel?: string;
  requesterTo?: string;
}): Promise<AnnounceTarget | null> {
  const parsed = resolveAnnounceTargetFromKey(params.sessionKey);
  const parsedDisplay = resolveAnnounceTargetFromKey(params.displayKey);
  const fallback = parsed ?? parsedDisplay ?? null;

  if (fallback) {
    const normalized = normalizeChannelId(fallback.channel);
    const plugin = normalized ? getChannelPlugin(normalized) : null;
    if (!plugin?.meta?.preferSessionLookupForAnnounceTarget) {
      return fallback;
    }
  }

  try {
    const list = (await callGateway({
      method: "sessions.list",
      params: {
        includeGlobal: true,
        includeUnknown: true,
        limit: 200,
      },
    })) as { sessions?: Array<Record<string, unknown>> };
    const sessions = Array.isArray(list?.sessions) ? list.sessions : [];
    const match =
      sessions.find((entry) => entry?.key === params.sessionKey) ??
      sessions.find((entry) => entry?.key === params.displayKey);

    const deliveryContext =
      match?.deliveryContext && typeof match.deliveryContext === "object"
        ? (match.deliveryContext as Record<string, unknown>)
        : undefined;
    const channel =
      (typeof deliveryContext?.channel === "string" ? deliveryContext.channel : undefined) ??
      (typeof match?.lastChannel === "string" ? match.lastChannel : undefined);
    const to =
      (typeof deliveryContext?.to === "string" ? deliveryContext.to : undefined) ??
      (typeof match?.lastTo === "string" ? match.lastTo : undefined);
    const accountId =
      (typeof deliveryContext?.accountId === "string" ? deliveryContext.accountId : undefined) ??
      (typeof match?.lastAccountId === "string" ? match.lastAccountId : undefined);

    if (channel && to && !isInternalMessageChannel(channel)) {
      return { channel, to, accountId };
    }
    if (channel && isInternalMessageChannel(channel)) {
      log.info("skipping internal channel from sessions.list", {
        sessionKey: params.sessionKey,
        channel,
      });
    }
  } catch (err) {
    log.debug("[announce-target] sessions.list failed", {
      sessionKey: params.sessionKey,
      error: formatErrorMessage(err),
    });
  }

  // Fallback: use requester's session key (e.g. SENA's group chat) so the
  // target agent can announce into the chat room the request originated from.
  if (params.requesterSessionKey) {
    const requesterParsed = resolveAnnounceTargetFromKey(params.requesterSessionKey);
    if (requesterParsed) return requesterParsed;
  }

  // Final fallback: use explicitly provided requester channel/to (from A2A flow)
  // This handles cases where session keys don't encode channel info (e.g. agent:name:main)
  if (
    params.requesterChannel &&
    params.requesterTo &&
    !isInternalMessageChannel(params.requesterChannel)
  ) {
    log.info("using requesterChannel/To as final fallback", {
      sessionKey: params.sessionKey,
      channel: params.requesterChannel,
      to: params.requesterTo,
    });
    return { channel: params.requesterChannel, to: params.requesterTo };
  }

  // Don't return internal channels (webchat) as announce targets
  if (fallback && isInternalMessageChannel(fallback.channel)) {
    return null;
  }
  return fallback;
}
