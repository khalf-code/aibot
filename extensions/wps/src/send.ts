import type { ChannelOutboundAdapter, ClawdbotConfig } from "clawdbot/plugin-sdk";
import { getAccessToken, resolveWpsCredentials } from "./token.js";
import type { WpsConfig } from "./types.js";

type WpsApiResponse = {
  code: number;
  msg: string;
  data?: {
    message_id?: string;
  };
};

/** WPS IDs are obfuscated strings with no specific format */
function isValidWpsTarget(to: string): boolean {
  const trimmed = to.trim();
  return trimmed.length > 0;
}

export const wpsOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",

  resolveTarget: ({ to, allowFrom }) => {
    const trimmed = to?.trim() ?? "";
    // Accept any non-empty target (WPS IDs are obfuscated strings)
    if (trimmed && isValidWpsTarget(trimmed)) {
      return { ok: true, to: trimmed };
    }
    // Fallback to first allowFrom entry
    const first = allowFrom?.[0];
    if (first) {
      return { ok: true, to: String(first).trim() };
    }
    return {
      ok: false,
      error: new Error("WPS target is required (user_id or chat_id)"),
    };
  },

  sendText: async ({ cfg, to, text }) => {
    const wpsCfg = (cfg as ClawdbotConfig).channels?.wps as WpsConfig | undefined;
    const creds = resolveWpsCredentials(wpsCfg);
    if (!creds) {
      throw new Error("WPS credentials not configured (appId, appSecret, and companyId required)");
    }

    if (!to?.trim()) {
      throw new Error("WPS target (to) is required");
    }

    const token = await getAccessToken(creds);
    // WPS365 single message API: POST /v7/messages/create
    const url = `${creds.baseUrl.replace(/\/$/, "")}/v7/messages/create`;

    // Parse receiver type from "to" field: "user:xxx" or "chat:xxx"
    // Default to "user" if no prefix
    let receiverType: "user" | "chat" = "user";
    let receiverId = to;
    if (to.startsWith("user:")) {
      receiverType = "user";
      receiverId = to.slice(5);
    } else if (to.startsWith("chat:")) {
      receiverType = "chat";
      receiverId = to.slice(5);
    }

    // WPS message format requires receiver object
    const requestBody = {
      type: "text",
      receiver: {
        type: receiverType,
        receiver_id: receiverId,
      },
      content: {
        text: {
          content: text,
          type: "plain",
        },
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WPS API error: ${res.status} ${body}`);
    }

    const data: unknown = await res.json();
    if (!data || typeof data !== "object") {
      throw new Error("WPS API returned invalid response");
    }

    const response = data as WpsApiResponse;
    if (response.code !== 0) {
      throw new Error(`WPS send error (code ${response.code}): ${response.msg}`);
    }

    return {
      channel: "wps" as const,
      messageId: response.data?.message_id ?? "",
      chatId: receiverId,
      timestamp: Date.now(),
    };
  },

  sendMedia: async () => {
    // TODO: implement media sending for WPS
    throw new Error("WPS media sending not yet implemented");
  },
};

/**
 * Send message to a specific user (not a chat).
 * Uses batch_create API with receivers array.
 */
export async function sendToUser(cfg: ClawdbotConfig, userId: string, text: string) {
  const wpsCfg = cfg.channels?.wps as WpsConfig | undefined;
  const creds = resolveWpsCredentials(wpsCfg);
  if (!creds) {
    throw new Error("WPS credentials not configured");
  }

  const token = await getAccessToken(creds);
  const url = `${creds.baseUrl.replace(/\/$/, "")}/v7/messages/batch_create`;

  const requestBody = {
    type: "text",
    receivers: [
      {
        type: "user",
        receiver_id: userId
      },
    ],
    content: {
      text: {
        content: text,
        type: "plain",
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WPS API error: ${res.status} ${body}`);
  }

  const data = await res.json() as WpsApiResponse;
  if (data.code !== 0) {
    throw new Error(`WPS send error (code ${data.code}): ${data.msg}`);
  }

  return {
    channel: "wps" as const,
    messageId: data.data?.message_id ?? "",
    chatId: userId,
    timestamp: Date.now(),
  };
}
