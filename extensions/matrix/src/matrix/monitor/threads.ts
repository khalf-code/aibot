import type { MatrixClient } from "@vector-im/matrix-bot-sdk";
import { downloadMatrixMedia } from "./media.js";

// Type for raw Matrix event from @vector-im/matrix-bot-sdk
type MatrixRawEvent = {
  event_id: string;
  sender: string;
  type: string;
  origin_server_ts: number;
  content: Record<string, unknown>;
  unsigned?: {
    redacted_because?: unknown;
  };
};

type RoomMessageEventContent = {
  msgtype: string;
  body: string;
  url?: string;
  file?: {
    url: string;
    key: { kty: string; key_ops: string[]; alg: string; k: string; ext: boolean };
    iv: string;
    hashes: Record<string, string>;
    v: string;
  };
  info?: { mimetype?: string; size?: number };
  "m.relates_to"?: {
    rel_type?: string;
    event_id?: string;
    "m.in_reply_to"?: { event_id?: string };
  };
};

const RelationType = {
  Thread: "m.thread",
} as const;

// Thread context types
export type MatrixThreadMessage = {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  msgtype?: string;
  mediaPath?: string;
  mediaType?: string;
};

export type MatrixThreadContext = {
  root: MatrixThreadMessage;
  replies: MatrixThreadMessage[];
};

// Cache for thread context to avoid repeated API calls
const THREAD_CONTEXT_CACHE = new Map<string, MatrixThreadContext>();

type ExtractedMessage = {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  msgtype?: string;
  mediaUrl?: string;
  mediaFile?: RoomMessageEventContent["file"];
  mediaContentType?: string;
};

function extractMessageFromEvent(event: MatrixRawEvent): ExtractedMessage | null {
  // Skip redacted events
  if (event.unsigned?.redacted_because) {
    return null;
  }
  const content = event.content as RoomMessageEventContent;
  const body = content?.body;
  if (typeof body !== "string" || !body.trim()) {
    return null;
  }

  // Extract media info (unencrypted: content.url, encrypted: content.file.url)
  const mediaUrl = content.url ?? content.file?.url;
  const contentInfo = content.info as { mimetype?: string } | undefined;

  return {
    eventId: event.event_id,
    sender: event.sender,
    body: body.trim(),
    timestamp: event.origin_server_ts,
    msgtype: content.msgtype,
    mediaUrl,
    mediaFile: content.file,
    mediaContentType: contentInfo?.mimetype,
  };
}

async function downloadMessageMedia(params: {
  client: MatrixClient;
  extracted: ExtractedMessage;
  maxBytes: number;
}): Promise<MatrixThreadMessage> {
  const { client, extracted, maxBytes } = params;
  let mediaPath: string | undefined;
  let mediaType: string | undefined;

  // Download media if present
  if (extracted.mediaUrl?.startsWith("mxc://")) {
    try {
      const media = await downloadMatrixMedia({
        client,
        mxcUrl: extracted.mediaUrl,
        contentType: extracted.mediaContentType,
        maxBytes,
        file: extracted.mediaFile,
      });
      if (media) {
        mediaPath = media.path;
        mediaType = media.contentType;
      }
    } catch {
      // Media download failed, continue without it
    }
  }

  return {
    eventId: extracted.eventId,
    sender: extracted.sender,
    body: extracted.body,
    timestamp: extracted.timestamp,
    msgtype: extracted.msgtype,
    mediaPath,
    mediaType,
  };
}

export async function fetchMatrixThreadContext(params: {
  client: MatrixClient;
  roomId: string;
  threadRootId: string;
  maxMessages?: number;
  maxMediaBytes?: number;
}): Promise<MatrixThreadContext | null> {
  const { client, roomId, threadRootId } = params;
  const maxMessages = params.maxMessages ?? 50;
  const maxMediaBytes = params.maxMediaBytes ?? 20 * 1024 * 1024; // 20MB default
  const cacheKey = `${roomId}:${threadRootId}`;

  // Check cache first
  const cached = THREAD_CONTEXT_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch thread root event
    const rootEvent = (await client.getEvent(roomId, threadRootId)) as MatrixRawEvent;
    const rootExtracted = extractMessageFromEvent(rootEvent);
    if (!rootExtracted) {
      return null;
    }

    // Download root media
    const root = await downloadMessageMedia({
      client,
      extracted: rootExtracted,
      maxBytes: maxMediaBytes,
    });

    // Fetch thread replies using relations API
    const res = (await client.doRequest(
      "GET",
      `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(threadRootId)}/${RelationType.Thread}`,
      { dir: "f", limit: maxMessages },
    )) as { chunk: MatrixRawEvent[] };

    // Extract and download media for all replies
    const replies: MatrixThreadMessage[] = [];
    for (const event of res.chunk ?? []) {
      const extracted = extractMessageFromEvent(event);
      if (extracted) {
        const msg = await downloadMessageMedia({
          client,
          extracted,
          maxBytes: maxMediaBytes,
        });
        replies.push(msg);
      }
    }

    // Sort replies by timestamp (oldest first)
    replies.sort((a, b) => a.timestamp - b.timestamp);

    const context: MatrixThreadContext = { root, replies };
    THREAD_CONTEXT_CACHE.set(cacheKey, context);
    return context;
  } catch {
    // Event not found, redacted, or inaccessible
    return null;
  }
}

export type FormattedThreadContext = {
  roomId: string;
  root: MatrixThreadMessage;
  replies: MatrixThreadMessage[];
};

export function formatMatrixThreadContext(params: {
  context: MatrixThreadContext;
  roomId: string;
  currentMessageEventId: string;
}): FormattedThreadContext {
  const { context, roomId, currentMessageEventId } = params;

  // Filter out the current message from replies
  const replies = context.replies.filter(
    (reply) => reply.eventId !== currentMessageEventId,
  );

  return {
    roomId,
    root: context.root,
    replies,
  };
}

export function resolveMatrixThreadTarget(params: {
  threadReplies: "off" | "inbound" | "always";
  messageId: string;
  threadRootId?: string;
  isThreadRoot?: boolean;
}): string | undefined {
  const { threadReplies, messageId, threadRootId } = params;
  if (threadReplies === "off") {
    return undefined;
  }
  const isThreadRoot = params.isThreadRoot === true;
  const hasInboundThread = Boolean(threadRootId && threadRootId !== messageId && !isThreadRoot);
  if (threadReplies === "inbound") {
    return hasInboundThread ? threadRootId : undefined;
  }
  if (threadReplies === "always") {
    return threadRootId ?? messageId;
  }
  return undefined;
}

export function resolveMatrixThreadRootId(params: {
  event: MatrixRawEvent;
  content: RoomMessageEventContent;
}): string | undefined {
  const relates = params.content["m.relates_to"];
  if (!relates || typeof relates !== "object") {
    return undefined;
  }
  if ("rel_type" in relates && relates.rel_type === RelationType.Thread) {
    if ("event_id" in relates && typeof relates.event_id === "string") {
      return relates.event_id;
    }
    if (
      "m.in_reply_to" in relates &&
      typeof relates["m.in_reply_to"] === "object" &&
      relates["m.in_reply_to"] &&
      "event_id" in relates["m.in_reply_to"] &&
      typeof relates["m.in_reply_to"].event_id === "string"
    ) {
      return relates["m.in_reply_to"].event_id;
    }
  }
  return undefined;
}
