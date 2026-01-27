/**
 * Mock SMS Provider for testing
 */

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

export class MockProvider implements SMSProvider {
  readonly name = "mock" as const;
  public sentMessages: Array<SendTextInput | SendMediaInput> = [];

  async initialize(): Promise<void> {
    // No-op
  }

  verifyWebhook(_ctx: WebhookContext, _secret?: string): WebhookVerificationResult {
    return { valid: true };
  }

  parseWebhook(ctx: WebhookContext): WebhookParseResult {
    const { body } = ctx;

    if (body.from && body.to) {
      return {
        type: "message",
        message: {
          from: body.from,
          to: body.to,
          text: body.text || "",
          messageId: `mock-${Date.now()}`,
          isMedia: false,
          mediaUrls: [],
        },
      };
    }

    return { type: "unknown" };
  }

  buildReplyResponse(_from: string, _to: string, text: string): string {
    return `<Response><Message>${text}</Message></Response>`;
  }

  async sendText(input: SendTextInput): Promise<SendResult> {
    this.sentMessages.push(input);
    return { ok: true, messageId: `mock-${Date.now()}` };
  }

  async sendMedia(input: SendMediaInput): Promise<SendResult> {
    this.sentMessages.push(input);
    return { ok: true, messageId: `mock-${Date.now()}` };
  }

  async configureWebhook(_input: ConfigureWebhookInput): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
}
