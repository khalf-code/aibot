import { formatLocationText, type NormalizedLocation } from "../../channels/location.js";
import type { TelegramAccountConfig } from "../../config/types.telegram.js";
import type {
  TelegramLocation,
  TelegramMessage,
  TelegramStreamMode,
  TelegramVenue,
} from "./types.js";

const TELEGRAM_GENERAL_TOPIC_ID = 1;

export function resolveTelegramForumThreadId(params: {
  isForum?: boolean;
  messageThreadId?: number | null;
}) {
  if (params.isForum && params.messageThreadId == null) {
    return TELEGRAM_GENERAL_TOPIC_ID;
  }
  return params.messageThreadId ?? undefined;
}

/**
 * Build thread params for Telegram API calls (messages, media).
 * General forum topic (id=1) must be treated like a regular supergroup send:
 * Telegram rejects sendMessage/sendMedia with message_thread_id=1 ("thread not found").
 */
export function buildTelegramThreadParams(messageThreadId?: number) {
  if (messageThreadId == null) {
    return undefined;
  }
  const normalized = Math.trunc(messageThreadId);
  if (normalized === TELEGRAM_GENERAL_TOPIC_ID) {
    return undefined;
  }
  return { message_thread_id: normalized };
}

/**
 * Build thread params for typing indicators (sendChatAction).
 * Empirically, General topic (id=1) needs message_thread_id for typing to appear.
 */
export function buildTypingThreadParams(messageThreadId?: number) {
  if (messageThreadId == null) {
    return undefined;
  }
  return { message_thread_id: Math.trunc(messageThreadId) };
}

export function resolveTelegramStreamMode(
  telegramCfg: Pick<TelegramAccountConfig, "streamMode"> | undefined,
): TelegramStreamMode {
  const raw = telegramCfg?.streamMode?.trim().toLowerCase();
  if (raw === "off" || raw === "partial" || raw === "block") return raw;
  return "partial";
}

export function buildTelegramGroupPeerId(chatId: number | string, messageThreadId?: number) {
  return messageThreadId != null ? `${chatId}:topic:${messageThreadId}` : String(chatId);
}

export function buildTelegramGroupFrom(chatId: number | string, messageThreadId?: number) {
  return `telegram:group:${buildTelegramGroupPeerId(chatId, messageThreadId)}`;
}

export function buildSenderName(msg: TelegramMessage) {
  const name =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ").trim() ||
    msg.from?.username;
  return name || undefined;
}

export function buildSenderLabel(msg: TelegramMessage, senderId?: number | string) {
  const name = buildSenderName(msg);
  const username = msg.from?.username ? `@${msg.from.username}` : undefined;
  let label = name;
  if (name && username) {
    label = `${name} (${username})`;
  } else if (!name && username) {
    label = username;
  }
  const normalizedSenderId =
    senderId != null && `${senderId}`.trim() ? `${senderId}`.trim() : undefined;
  const fallbackId = normalizedSenderId ?? (msg.from?.id != null ? String(msg.from.id) : undefined);
  const idPart = fallbackId ? `id:${fallbackId}` : undefined;
  if (label && idPart) return `${label} ${idPart}`;
  if (label) return label;
  return idPart ?? "id:unknown";
}

export function buildGroupLabel(
  msg: TelegramMessage,
  chatId: number | string,
  messageThreadId?: number,
) {
  const title = msg.chat?.title;
  const topicSuffix = messageThreadId != null ? ` topic:${messageThreadId}` : "";
  if (title) return `${title} id:${chatId}${topicSuffix}`;
  return `group:${chatId}${topicSuffix}`;
}

export function hasBotMention(msg: TelegramMessage, botUsername: string) {
  const text = (msg.text ?? msg.caption ?? "").toLowerCase();
  if (text.includes(`@${botUsername}`)) return true;
  const entities = msg.entities ?? msg.caption_entities ?? [];
  for (const ent of entities) {
    if (ent.type !== "mention") continue;
    const slice = (msg.text ?? msg.caption ?? "").slice(ent.offset, ent.offset + ent.length);
    if (slice.toLowerCase() === `@${botUsername}`) return true;
  }
  return false;
}

export function resolveTelegramReplyId(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function describeReplyTarget(msg: TelegramMessage) {
  const reply = msg.reply_to_message;
  if (!reply) return null;
  const replyBody = (reply.text ?? reply.caption ?? "").trim();
  let body = replyBody;
  if (!body) {
    if (reply.photo) body = "<media:image>";
    else if (reply.video) body = "<media:video>";
    else if (reply.audio || reply.voice) body = "<media:audio>";
    else if (reply.document) body = "<media:document>";
    else {
      const locationData = extractTelegramLocation(reply);
      if (locationData) body = formatLocationText(locationData);
    }
  }
  if (!body) return null;
  const sender = buildSenderName(reply);
  const senderLabel = sender ? `${sender}` : "unknown sender";
  return {
    id: reply.message_id ? String(reply.message_id) : undefined,
    sender: senderLabel,
    body,
  };
}

/**
 * Extract forwarded message origin info from Telegram message.
 * Supports both new forward_origin API and legacy forward_from/forward_from_chat fields.
 */
export function describeForwardOrigin(msg: TelegramMessage): {
  source: string;
  date?: number;
} | null {
  const msgAny = msg as unknown as Record<string, unknown>;
  const forwardOrigin = msgAny.forward_origin as
    | {
        type: string;
        sender_user?: { first_name?: string; last_name?: string; username?: string; id?: number };
        sender_user_name?: string;
        sender_chat?: { title?: string; id?: number; username?: string };
        chat?: { title?: string; id?: number; username?: string };
        date?: number;
      }
    | undefined;
  const forwardFrom = msgAny.forward_from as
    | { first_name?: string; last_name?: string; username?: string; id?: number }
    | undefined;
  const forwardFromChat = msgAny.forward_from_chat as
    | { title?: string; id?: number; username?: string; type?: string }
    | undefined;
  const forwardDate = msgAny.forward_date as number | undefined;
  const forwardSenderName =
    typeof msgAny.forward_sender_name === "string" ? msgAny.forward_sender_name.trim() : undefined;
  const forwardSignature =
    typeof msgAny.forward_signature === "string" ? msgAny.forward_signature.trim() : undefined;

  const formatUserSource = (user?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    id?: number;
  }) => {
    if (!user) return undefined;
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    const username = user.username ? `@${user.username}` : undefined;
    if (name && username) return `${name} (${username})`;
    if (name) return name;
    if (username) return username;
    if (user.id != null) return `user:${user.id}`;
    return undefined;
  };

  const formatChatSource = (
    chat: { title?: string; id?: number; username?: string } | undefined,
    fallback: "chat" | "channel",
  ) => {
    if (!chat) return undefined;
    if (chat.title) return chat.title;
    if (chat.username) return `@${chat.username}`;
    if (chat.id != null) return `${fallback}:${chat.id}`;
    return undefined;
  };

  // Try newer forward_origin first
  if (forwardOrigin) {
    let source: string | undefined;
    if (forwardOrigin.type === "user" && forwardOrigin.sender_user) {
      source = formatUserSource(forwardOrigin.sender_user);
    } else if (forwardOrigin.type === "hidden_user" && forwardOrigin.sender_user_name) {
      source = forwardOrigin.sender_user_name.trim() || undefined;
    } else if (forwardOrigin.type === "chat" && forwardOrigin.sender_chat) {
      source = formatChatSource(forwardOrigin.sender_chat, "chat");
    } else if (forwardOrigin.type === "channel" && forwardOrigin.chat) {
      source = formatChatSource(forwardOrigin.chat, "channel");
    }
    if (source) return { source, date: forwardOrigin.date };
  }

  // Legacy forward_from_chat
  if (forwardFromChat) {
    const base = formatChatSource(forwardFromChat, "chat");
    const source = base
      ? forwardSignature
        ? `${base} (${forwardSignature})`
        : base
      : forwardSignature ?? forwardSenderName;
    if (source) return { source, date: forwardDate };
  }

  // Legacy forward_from
  if (forwardFrom) {
    const source = formatUserSource(forwardFrom);
    if (source) return { source, date: forwardDate };
  }

  if (forwardSenderName) {
    return { source: forwardSenderName, date: forwardDate };
  }

  return null;
}

/**
 * Telegram entity with text_link fields.
 */
type TextLinkEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
};

/**
 * Expand text_link entities into markdown format.
 * Converts "[text](url)" style links stored in entities back into visible markdown.
 */
export function expandTextLinks(
  text: string,
  entities?: TextLinkEntity[] | null,
): string {
  if (!text || !entities?.length) return text;

  // Filter text_link entities with valid URLs
  const textLinks = entities
    .filter((e): e is TextLinkEntity & { url: string } => e.type === "text_link" && Boolean(e.url))
    .sort((a, b) => b.offset - a.offset); // Sort descending to preserve offsets

  if (textLinks.length === 0) return text;

  let result = text;
  for (const entity of textLinks) {
    const linkText = text.slice(entity.offset, entity.offset + entity.length);
    const markdown = `[${linkText}](${entity.url})`;
    result = result.slice(0, entity.offset) + markdown + result.slice(entity.offset + entity.length);
  }
  return result;
}

export function extractTelegramLocation(msg: TelegramMessage): NormalizedLocation | null {
  const msgWithLocation = msg as {
    location?: TelegramLocation;
    venue?: TelegramVenue;
  };
  const { venue, location } = msgWithLocation;

  if (venue) {
    return {
      latitude: venue.location.latitude,
      longitude: venue.location.longitude,
      accuracy: venue.location.horizontal_accuracy,
      name: venue.title,
      address: venue.address,
      source: "place",
      isLive: false,
    };
  }

  if (location) {
    const isLive = typeof location.live_period === "number" && location.live_period > 0;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.horizontal_accuracy,
      source: isLive ? "live" : "pin",
      isLive,
    };
  }

  return null;
}
