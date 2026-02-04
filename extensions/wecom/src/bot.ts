/**
 * 企业微信消息处理
 *
 * 按参考实现的 session/envelope + buffered dispatcher 方式分发
 */

import { checkDmPolicy, checkGroupPolicy, createLogger, type Logger } from "@openclaw/china-shared";
import type { PluginRuntime } from "./runtime.js";
import type { ResolvedWecomAccount, WecomInboundMessage, WecomDmPolicy } from "./types.js";
import {
  resolveAllowFrom,
  resolveGroupAllowFrom,
  resolveGroupPolicy,
  resolveRequireMention,
  type PluginConfig,
} from "./config.js";

export type WecomDispatchHooks = {
  onChunk: (text: string) => void;
  onError?: (err: unknown) => void;
};

export function extractWecomContent(msg: WecomInboundMessage): string {
  const msgtype = String(msg.msgtype ?? "").toLowerCase();
  if (msgtype === "text") {
    const content = (msg as { text?: { content?: string } }).text?.content;
    return typeof content === "string" ? content : "";
  }
  if (msgtype === "voice") {
    const content = (msg as { voice?: { content?: string } }).voice?.content;
    return typeof content === "string" ? content : "[voice]";
  }
  if (msgtype === "mixed") {
    const items = (msg as { mixed?: { msg_item?: unknown } }).mixed?.msg_item;
    if (Array.isArray(items)) {
      return items
        .map((item: unknown) => {
          if (!item || typeof item !== "object") return "";
          const typed = item as {
            msgtype?: string;
            text?: { content?: string };
            image?: { url?: string };
          };
          const t = String(typed.msgtype ?? "").toLowerCase();
          if (t === "text") return String(typed.text?.content ?? "");
          if (t === "image") return `[image] ${String(typed.image?.url ?? "").trim()}`.trim();
          return t ? `[${t}]` : "";
        })
        .filter((part) => Boolean(part && part.trim()))
        .join("\n");
    }
    return "[mixed]";
  }
  if (msgtype === "image") {
    const url = String((msg as { image?: { url?: string } }).image?.url ?? "").trim();
    return url ? `[image] ${url}` : "[image]";
  }
  if (msgtype === "file") {
    const url = String((msg as { file?: { url?: string } }).file?.url ?? "").trim();
    return url ? `[file] ${url}` : "[file]";
  }
  if (msgtype === "event") {
    const eventtype = String(
      (msg as { event?: { eventtype?: string } }).event?.eventtype ?? "",
    ).trim();
    return eventtype ? `[event] ${eventtype}` : "[event]";
  }
  if (msgtype === "stream") {
    const id = String((msg as { stream?: { id?: string } }).stream?.id ?? "").trim();
    return id ? `[stream_refresh] ${id}` : "[stream_refresh]";
  }
  return msgtype ? `[${msgtype}]` : "";
}

function resolveSenderId(msg: WecomInboundMessage): string {
  const userid = msg.from?.userid?.trim();
  return userid || "unknown";
}

function resolveChatType(msg: WecomInboundMessage): "direct" | "group" {
  return msg.chattype === "group" ? "group" : "direct";
}

function resolveChatId(
  msg: WecomInboundMessage,
  senderId: string,
  chatType: "direct" | "group",
): string {
  if (chatType === "group") {
    return msg.chatid?.trim() || "unknown";
  }
  return senderId;
}

function buildInboundBody(msg: WecomInboundMessage): string {
  const msgtype = String(msg.msgtype ?? "").toLowerCase();
  if (msgtype === "text") {
    const content = (msg as { text?: { content?: string } }).text?.content;
    return typeof content === "string" ? content : "";
  }
  if (msgtype === "voice") {
    const content = (msg as { voice?: { content?: string } }).voice?.content;
    return typeof content === "string" ? content : "[voice]";
  }
  if (msgtype === "mixed") {
    const items = (msg as { mixed?: { msg_item?: unknown } }).mixed?.msg_item;
    if (Array.isArray(items)) {
      return items
        .map((item: unknown) => {
          if (!item || typeof item !== "object") return "";
          const typed = item as {
            msgtype?: string;
            text?: { content?: string };
            image?: { url?: string };
          };
          const t = String(typed.msgtype ?? "").toLowerCase();
          if (t === "text") return String(typed.text?.content ?? "");
          if (t === "image") return `[image] ${String(typed.image?.url ?? "").trim()}`.trim();
          return t ? `[${t}]` : "";
        })
        .filter((part) => Boolean(part && part.trim()))
        .join("\n");
    }
    return "[mixed]";
  }
  if (msgtype === "image") {
    const url = String((msg as { image?: { url?: string } }).image?.url ?? "").trim();
    return url ? `[image] ${url}` : "[image]";
  }
  if (msgtype === "file") {
    const url = String((msg as { file?: { url?: string } }).file?.url ?? "").trim();
    return url ? `[file] ${url}` : "[file]";
  }
  if (msgtype === "event") {
    const eventtype = String(
      (msg as { event?: { eventtype?: string } }).event?.eventtype ?? "",
    ).trim();
    return eventtype ? `[event] ${eventtype}` : "[event]";
  }
  if (msgtype === "stream") {
    const id = String((msg as { stream?: { id?: string } }).stream?.id ?? "").trim();
    return id ? `[stream_refresh] ${id}` : "[stream_refresh]";
  }
  return msgtype ? `[${msgtype}]` : "";
}

export async function dispatchWecomMessage(params: {
  cfg?: PluginConfig;
  account: ResolvedWecomAccount;
  msg: WecomInboundMessage;
  core: PluginRuntime;
  hooks: WecomDispatchHooks;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
}): Promise<void> {
  const { cfg, account, msg, core, hooks } = params;
  const safeCfg = (cfg ?? {}) as PluginConfig;

  const logger: Logger = createLogger("wecom", { log: params.log, error: params.error });

  const chatType = resolveChatType(msg);
  const senderId = resolveSenderId(msg);
  const chatId = resolveChatId(msg, senderId, chatType);

  const accountConfig = account?.config ?? {};

  if (chatType === "group") {
    const groupPolicy = resolveGroupPolicy(accountConfig);
    const groupAllowFrom = resolveGroupAllowFrom(accountConfig);
    const requireMention = resolveRequireMention(accountConfig);

    const policyResult = checkGroupPolicy({
      groupPolicy,
      conversationId: chatId,
      groupAllowFrom,
      requireMention,
      mentionedBot: true,
    });

    if (!policyResult.allowed) {
      logger.debug(`policy rejected: ${policyResult.reason}`);
      return;
    }
  } else {
    const dmPolicyRaw: WecomDmPolicy = accountConfig.dmPolicy ?? "pairing";
    if (dmPolicyRaw === "disabled") {
      logger.debug("dmPolicy=disabled, skipping dispatch");
      return;
    }

    const allowFrom = resolveAllowFrom(accountConfig);
    const policyResult = checkDmPolicy({
      dmPolicy: dmPolicyRaw,
      senderId,
      allowFrom,
    });

    if (!policyResult.allowed) {
      logger.debug(`policy rejected: ${policyResult.reason}`);
      return;
    }
  }

  const channel = core.channel;
  if (
    !channel?.routing?.resolveAgentRoute ||
    !channel.reply?.dispatchReplyWithBufferedBlockDispatcher
  ) {
    logger.debug("core routing or buffered dispatcher missing, skipping dispatch");
    return;
  }

  const route = channel.routing.resolveAgentRoute({
    cfg: safeCfg,
    channel: "wecom",
    peer: { kind: chatType === "group" ? "group" : "dm", id: chatId },
  });

  const rawBody = buildInboundBody(msg);
  const fromLabel = chatType === "group" ? `group:${chatId}` : `user:${senderId}`;

  const storePath = channel.session?.resolveStorePath?.(safeCfg.session?.store, {
    agentId: route.agentId,
  });

  const previousTimestamp = channel.session?.readSessionUpdatedAt
    ? (channel.session.readSessionUpdatedAt({
        storePath,
        sessionKey: route.sessionKey,
      }) ?? undefined)
    : undefined;

  const envelopeOptions = channel.reply?.resolveEnvelopeFormatOptions
    ? channel.reply.resolveEnvelopeFormatOptions(safeCfg)
    : undefined;

  const body = channel.reply?.formatAgentEnvelope
    ? channel.reply.formatAgentEnvelope({
        channel: "WeCom",
        from: fromLabel,
        previousTimestamp,
        envelope: envelopeOptions,
        body: rawBody,
      })
    : rawBody;

  const ctxPayload = (
    channel.reply?.finalizeInboundContext
      ? channel.reply.finalizeInboundContext({
          Body: body,
          RawBody: rawBody,
          CommandBody: rawBody,
          From: chatType === "group" ? `wecom:group:${chatId}` : `wecom:${senderId}`,
          To: `wecom:${chatId}`,
          SessionKey: route.sessionKey,
          AccountId: route.accountId,
          ChatType: chatType,
          ConversationLabel: fromLabel,
          SenderName: senderId,
          SenderId: senderId,
          Provider: "wecom",
          Surface: "wecom",
          MessageSid: msg.msgid,
          OriginatingChannel: "wecom",
          OriginatingTo: `wecom:${chatId}`,
        })
      : {
          Body: body,
          RawBody: rawBody,
          CommandBody: rawBody,
          From: chatType === "group" ? `wecom:group:${chatId}` : `wecom:${senderId}`,
          To: `wecom:${chatId}`,
          SessionKey: route.sessionKey,
          AccountId: route.accountId,
          ChatType: chatType,
          ConversationLabel: fromLabel,
          SenderName: senderId,
          SenderId: senderId,
          Provider: "wecom",
          Surface: "wecom",
          MessageSid: msg.msgid,
          OriginatingChannel: "wecom",
          OriginatingTo: `wecom:${chatId}`,
        }
  ) as {
    SessionKey?: string;
    [key: string]: unknown;
  };

  if (channel.session?.recordInboundSession && storePath) {
    await channel.session.recordInboundSession({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
      onRecordError: (err: unknown) => {
        logger.error(`wecom: failed updating session meta: ${String(err)}`);
      },
    });
  }

  const tableMode = channel.text?.resolveMarkdownTableMode
    ? channel.text.resolveMarkdownTableMode({
        cfg: safeCfg,
        channel: "wecom",
        accountId: account.accountId,
      })
    : undefined;

  await channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: safeCfg,
    dispatcherOptions: {
      deliver: async (payload: { text?: string }) => {
        const rawText = payload.text ?? "";
        if (!rawText.trim()) return;
        const converted =
          channel.text?.convertMarkdownTables && tableMode
            ? channel.text.convertMarkdownTables(rawText, tableMode)
            : rawText;
        hooks.onChunk(converted);
      },
      onError: (err: unknown, info: { kind: string }) => {
        hooks.onError?.(err);
        logger.error(`${info.kind} reply failed: ${String(err)}`);
      },
    },
  });
}
