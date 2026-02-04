// @ts-nocheck
import { createInternalHookEvent, triggerInternalHook } from "../hooks/internal-hooks.js";
import { buildTelegramMessageContext } from "./bot-message-context.js";
import { dispatchTelegramMessage } from "./bot-message-dispatch.js";

export const createTelegramMessageProcessor = (deps) => {
  const {
    bot,
    cfg,
    account,
    telegramCfg,
    historyLimit,
    groupHistories,
    dmPolicy,
    allowFrom,
    groupAllowFrom,
    ackReactionScope,
    logger,
    resolveGroupActivation,
    resolveGroupRequireMention,
    resolveTelegramGroupConfig,
    runtime,
    replyToMode,
    streamMode,
    textLimit,
    opts,
    resolveBotTopicsEnabled,
  } = deps;

  return async (primaryCtx, allMedia, storeAllowFrom, options) => {
    const context = await buildTelegramMessageContext({
      primaryCtx,
      allMedia,
      storeAllowFrom,
      options,
      bot,
      cfg,
      account,
      historyLimit,
      groupHistories,
      dmPolicy,
      allowFrom,
      groupAllowFrom,
      ackReactionScope,
      logger,
      resolveGroupActivation,
      resolveGroupRequireMention,
      resolveTelegramGroupConfig,
    });
    if (!context) {
      return;
    }

    // Trigger message:received hook
    const { ctxPayload, chatId, isGroup, msg } = context;
    await triggerInternalHook(
      createInternalHookEvent("message", "received", ctxPayload.SessionKey ?? "", {
        ctxPayload,
        channel: "telegram",
        messageId: ctxPayload.MessageSid ?? String(msg.message_id),
        from: ctxPayload.From ?? "",
        to: ctxPayload.To ?? "",
        isGroup,
        chatId: String(chatId),
        senderId: ctxPayload.SenderId || undefined,
        hasMedia: Boolean(ctxPayload.MediaPath),
        mediaCount: ctxPayload.MediaPaths?.length ?? (ctxPayload.MediaPath ? 1 : 0),
        timestamp: msg.date ? msg.date * 1000 : undefined,
      }),
    );

    await dispatchTelegramMessage({
      context,
      bot,
      cfg,
      runtime,
      replyToMode,
      streamMode,
      textLimit,
      telegramCfg,
      opts,
      resolveBotTopicsEnabled,
    });
  };
};
