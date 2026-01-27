/**
 * Plivo SMS Provider Implementation
 */

import * as Plivo from "plivo";
import type {
  SMSProvider,
  WebhookContext,
  WebhookVerificationResult,
  WebhookParseResult,
  SendTextInput,
  SendMediaInput,
  SendResult,
  ConfigureWebhookInput,
} from "./base.js";

export type PlivoProviderConfig = {
  authId: string;
  authToken: string;
};

export class PlivoProvider implements SMSProvider {
  readonly name = "plivo" as const;
  private client: Plivo.Client;
  private config: PlivoProviderConfig;

  constructor(config: PlivoProviderConfig) {
    this.config = config;
    this.client = new Plivo.Client(config.authId, config.authToken);
  }

  async initialize(): Promise<void> {
    // Verify credentials
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.client.accounts as any).get();
  }

  verifyWebhook(ctx: WebhookContext, secret?: string): WebhookVerificationResult {
    if (!secret) return { valid: true };

    const signature = ctx.req.headers["x-plivo-signature-v3"] as string;
    const nonce = ctx.req.headers["x-plivo-signature-v3-nonce"] as string;

    if (!signature || !nonce) {
      return { valid: false, error: "Missing signature headers" };
    }

    try {
      const isValid = Plivo.validateV3Signature(
        ctx.req.method || "POST",
        ctx.url,
        nonce,
        secret,
        signature,
        ctx.body
      );
      return { valid: Boolean(isValid) };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  parseWebhook(ctx: WebhookContext): WebhookParseResult {
    const { body } = ctx;

    // Check if this is a status callback
    if (body.Status && body.MessageUUID && !body.Text) {
      return {
        type: "status",
        status: {
          messageId: body.MessageUUID,
          status: body.Status,
          errorCode: body.ErrorCode,
        },
      };
    }

    // Inbound message
    if (body.From && body.To) {
      const mediaUrls: string[] = [];
      for (let i = 0; i < 10; i++) {
        const url = body[`MediaUrl${i}`];
        if (url) mediaUrls.push(url);
      }

      const isMedia = body.Type === "mms" || mediaUrls.length > 0;

      return {
        type: "message",
        message: {
          from: body.From,
          to: body.To,
          text: body.Text || "",
          messageId: body.MessageUUID,
          isMedia,
          mediaUrls,
        },
      };
    }

    return { type: "unknown" };
  }

  buildReplyResponse(from: string, to: string, text: string): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = (Plivo as any).Response();
    response.addMessage(text, { src: from, dst: to });
    return response.toXML();
  }

  async sendText(input: SendTextInput): Promise<SendResult> {
    try {
      const response = await this.client.messages.create(
        input.from,
        input.to,
        input.text
      );
      const messageId = Array.isArray(response.messageUuid)
        ? response.messageUuid[0]
        : response.messageUuid;
      return { ok: true, messageId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async sendMedia(input: SendMediaInput): Promise<SendResult> {
    try {
      const response = await this.client.messages.create(
        input.from,
        input.to,
        input.text || "",
        {
          type: "mms",
          media_urls: input.mediaUrls,
        }
      );
      const messageId = Array.isArray(response.messageUuid)
        ? response.messageUuid[0]
        : response.messageUuid;
      return { ok: true, messageId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async configureWebhook(input: ConfigureWebhookInput): Promise<{ success: boolean; error?: string }> {
    const normalizedNumber = input.phoneNumber.replace(/^\+/, "");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.client.numbers as any).update(normalizedNumber, {
        message_url: input.webhookUrl,
        message_method: "POST",
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
