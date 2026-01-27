import type { AgentMailClient } from "agentmail";
import type { ChannelOutboundAdapter } from "clawdbot/plugin-sdk";

import { getClientAndInbox } from "./client.js";
import { getAgentMailRuntime } from "./runtime.js";

/** Sends a reply to an email message via AgentMail. */
export async function sendAgentMailReply(params: {
  client: AgentMailClient;
  inboxId: string;
  messageId: string;
  text: string;
  html?: string;
}): Promise<{ messageId: string; threadId: string }> {
  const { client, inboxId, messageId, text, html } = params;
  return client.inboxes.messages.reply(inboxId, messageId, { text, html });
}

/** Sends a message (reply or new) and returns standardized result. */
async function sendMessage(params: {
  to: string;
  text: string;
  html?: string;
  replyToId?: string;
}): Promise<{ channel: "agentmail"; messageId: string; threadId: string }> {
  const { to, text, html, replyToId } = params;
  const { client, inboxId } = getClientAndInbox();

  const result = replyToId
    ? await client.inboxes.messages.reply(inboxId, replyToId, { text, html })
    : await client.inboxes.messages.send(inboxId, { to: [to], text, html });

  return { channel: "agentmail", ...result };
}

/** Outbound adapter for the AgentMail channel. */
export const agentmailOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: (text, limit) => getAgentMailRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: "markdown",
  textChunkLimit: 4000,

  sendText: ({ to, text, replyToId }) => sendMessage({ to, text, replyToId: replyToId ?? undefined }),

  sendMedia: ({ to, text, mediaUrl, replyToId }) => {
    const fullText = mediaUrl ? `${text}\n\nAttachment: ${mediaUrl}` : text;
    return sendMessage({ to, text: fullText, replyToId: replyToId ?? undefined });
  },
};
