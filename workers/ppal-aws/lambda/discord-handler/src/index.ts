import {
  APIInteraction,
  InteractionType,
  InteractionResponseType,
  APIApplicationCommandInteraction,
} from "discord-api-types/payloads/v10";
import { verifySignature, extractSignatureHeaders } from "./discord/verify.js";
import {
  handlePing,
  handleApplicationCommand,
} from "./discord/commands.js";

/**
 * Lambda ハンドラー
 */
export const handler = async (event: {
  headers: { [key: string]: string | undefined };
  body: string | null;
}): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> => {
  // Headers are lowercase in API Gateway
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  const signatureData = extractSignatureHeaders(headers);

  if (!signatureData) {
    console.error("Missing signature headers");
    return errorResponse(401, "Missing signature headers");
  }

  const { signature, timestamp } = signatureData;
  const body = event.body || "";

  // Signature verification
  const isValid = await verifySignature(body, signature, timestamp);

  if (!isValid) {
    console.error("Invalid signature");
    return errorResponse(401, "Invalid signature");
  }

  // Parse interaction
  let interaction: APIInteraction;
  try {
    interaction = JSON.parse(body);
  } catch (error) {
    console.error("Failed to parse interaction body:", error);
    return errorResponse(400, "Invalid JSON");
  }

  // Handle interaction
  try {
    let response:
      | { type: InteractionResponseType.Pong }
      | { type: InteractionResponseType.ChannelMessageWithSource; data: { content: string; flags?: number } };

    switch (interaction.type) {
      case InteractionType.Ping:
        response = handlePing();
        break;

      case InteractionType.ApplicationCommand:
        response = await handleApplicationCommand(
          interaction as APIApplicationCommandInteraction
        );
        break;

      default:
        console.warn(`Unhandled interaction type: ${interaction.type}`);
        return errorResponse(400, "Unhandled interaction type");
    }

    return jsonResponse(JSON.stringify(response));
  } catch (error) {
    console.error("Error handling interaction:", error);
    return errorResponse(500, "Internal server error");
  }
};

/**
 * JSONレスポンス
 */
function jsonResponse(body: string): {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
} {
  return {
    statusCode: 200,
    body,
    headers: {
      "Content-Type": "application/json",
    },
  };
}

/**
 * エラーレスポンス
 */
function errorResponse(
  statusCode: number,
  message: string
): {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
} {
  return {
    statusCode,
    body: JSON.stringify({ error: message }),
    headers: {
      "Content-Type": "application/json",
    },
  };
}
