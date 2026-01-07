<<<<<<< HEAD
=======
import { loadConfig } from "../../config/config.js";
>>>>>>> upstream/main
import type { AnyAgentTool } from "./common.js";
import { handleWhatsAppAction } from "./whatsapp-actions.js";
import { WhatsAppToolSchema } from "./whatsapp-schema.js";

export function createWhatsAppTool(): AnyAgentTool {
  return {
    label: "WhatsApp",
    name: "whatsapp",
<<<<<<< HEAD
    description:
      "Send WhatsApp messages with optional media attachments. Use for outbound messages to phone numbers.",
    parameters: WhatsAppToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      return await handleWhatsAppAction(params);
=======
    description: "Manage WhatsApp reactions.",
    parameters: WhatsAppToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const cfg = loadConfig();
      return await handleWhatsAppAction(params, cfg);
>>>>>>> upstream/main
    },
  };
}
