import type { AgentToolResult } from "@mariozechner/pi-agent-core";

<<<<<<< HEAD
import { shouldLogVerbose } from "../../globals.js";
import { getActiveWebListener } from "../../web/active-listener.js";
import { sendMessageWhatsApp } from "../../web/outbound.js";
import { jsonResult, readStringParam } from "./common.js";

export async function handleWhatsAppAction(
  params: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const action = readStringParam(params, "action", { required: true });

  switch (action) {
    case "send": {
      const to = readStringParam(params, "to", { required: true });
      const message = readStringParam(params, "message", { required: true });
      const mediaUrl = readStringParam(params, "mediaUrl");
      const gifPlayback = typeof params.gifPlayback === "boolean" ? params.gifPlayback : undefined;

      // Normalize phone number - ensure it starts with +
      const normalizedTo = to.startsWith("+") ? to : `+${to}`;

      const result = await sendMessageWhatsApp(normalizedTo, message, {
        mediaUrl: mediaUrl ?? undefined,
        gifPlayback: gifPlayback ?? undefined,
        verbose: shouldLogVerbose(),
      });

      return jsonResult({
        ok: true,
        messageId: result.messageId,
        to: result.toJid,
      });
    }

    case "status": {
      const active = getActiveWebListener();
      if (!active) {
        return jsonResult({
          connected: false,
          message: "WhatsApp gateway not active",
        });
      }
      return jsonResult({
        connected: true,
        message: "WhatsApp gateway connected",
      });
    }

    default:
      throw new Error(`Unknown WhatsApp action: ${action}`);
  }
=======
import type { ClawdbotConfig } from "../../config/config.js";
import { sendReactionWhatsApp } from "../../web/outbound.js";
import {
  createActionGate,
  jsonResult,
  readReactionParams,
  readStringParam,
} from "./common.js";

export async function handleWhatsAppAction(
  params: Record<string, unknown>,
  cfg: ClawdbotConfig,
): Promise<AgentToolResult<unknown>> {
  const action = readStringParam(params, "action", { required: true });
  const isActionEnabled = createActionGate(cfg.whatsapp?.actions);

  if (action === "react") {
    if (!isActionEnabled("reactions")) {
      throw new Error("WhatsApp reactions are disabled.");
    }
    const chatJid = readStringParam(params, "chatJid", { required: true });
    const messageId = readStringParam(params, "messageId", { required: true });
    const { emoji, remove, isEmpty } = readReactionParams(params, {
      removeErrorMessage: "Emoji is required to remove a WhatsApp reaction.",
    });
    const participant = readStringParam(params, "participant");
    const accountId = readStringParam(params, "accountId");
    const fromMeRaw = params.fromMe;
    const fromMe = typeof fromMeRaw === "boolean" ? fromMeRaw : undefined;
    const resolvedEmoji = remove ? "" : emoji;
    await sendReactionWhatsApp(chatJid, messageId, resolvedEmoji, {
      verbose: false,
      fromMe,
      participant: participant ?? undefined,
      accountId: accountId ?? undefined,
    });
    if (!remove && !isEmpty) {
      return jsonResult({ ok: true, added: emoji });
    }
    return jsonResult({ ok: true, removed: true });
  }

  throw new Error(`Unsupported WhatsApp action: ${action}`);
>>>>>>> upstream/main
}
