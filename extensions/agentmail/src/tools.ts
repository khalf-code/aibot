import { type Static, Type } from "@sinclair/typebox";
import type { ChannelAgentTool } from "clawdbot/plugin-sdk";

import { formatAttachmentResponse } from "./attachment.js";
import { getClientAndInbox } from "./client.js";

const GetAttachmentParams = Type.Object({
  messageId: Type.String({ description: "The message ID containing the attachment" }),
  attachmentId: Type.String({ description: "The attachment ID to fetch" }),
});

/** Creates the get_email_attachment tool for fetching attachment download URLs. */
export function createGetAttachmentTool(): ChannelAgentTool {
  return {
    label: "Get Email Attachment",
    name: "get_email_attachment",
    description:
      "Fetch a temporary download URL for an email attachment. Use the attachment ID from the thread context.",
    parameters: GetAttachmentParams,
    execute: async (_toolCallId, args) => {
      const { messageId, attachmentId } = args as Static<typeof GetAttachmentParams>;

      try {
        const { client, inboxId } = getClientAndInbox();
        const attachment = await client.inboxes.messages.getAttachment(inboxId, messageId, attachmentId);

        return {
          content: [{ type: "text", text: formatAttachmentResponse(attachment) }],
          details: attachment,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to fetch attachment: ${err instanceof Error ? err.message : String(err)}` }],
          details: {},
          isError: true,
        };
      }
    },
  };
}

/**
 * Returns all AgentMail agent tools.
 */
export function createAgentMailTools(): ChannelAgentTool[] {
  return [createGetAttachmentTool()];
}
