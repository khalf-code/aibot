/**
 * Abstract base interface for SMS providers.
 *
 * Each provider (Plivo, Twilio, etc.) implements this interface to provide
 * a consistent API for the SMS channel.
 */

import type { IncomingMessage } from "node:http";

export type ProviderName = "plivo" | "twilio" | "mock";

export type WebhookContext = {
  req: IncomingMessage;
  body: Record<string, string>;
  rawBody: string;
  url: string;
};

export type WebhookVerificationResult = {
  valid: boolean;
  error?: string;
};

export type InboundMessage = {
  from: string;
  to: string;
  text: string;
  messageId: string;
  isMedia: boolean;
  mediaUrls: string[];
};

export type WebhookParseResult = {
  type: "message" | "status" | "unknown";
  message?: InboundMessage;
  status?: {
    messageId: string;
    status: string;
    errorCode?: string;
  };
  response?: string; // XML response to send back
};

export type SendTextInput = {
  from: string;
  to: string;
  text: string;
};

export type SendMediaInput = {
  from: string;
  to: string;
  text?: string;
  mediaUrls: string[];
};

export type SendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export type ConfigureWebhookInput = {
  phoneNumber: string;
  webhookUrl: string;
};

/**
 * SMS Provider interface
 */
export interface SMSProvider {
  /** Provider identifier */
  readonly name: ProviderName;

  /**
   * Initialize the provider with credentials
   */
  initialize(): Promise<void>;

  /**
   * Verify webhook signature/HMAC before processing
   */
  verifyWebhook(ctx: WebhookContext, secret?: string): WebhookVerificationResult;

  /**
   * Parse provider-specific webhook payload into normalized message
   */
  parseWebhook(ctx: WebhookContext): WebhookParseResult;

  /**
   * Build XML response for immediate reply
   */
  buildReplyResponse(from: string, to: string, text: string): string;

  /**
   * Send SMS text message
   */
  sendText(input: SendTextInput): Promise<SendResult>;

  /**
   * Send MMS with media attachments
   */
  sendMedia(input: SendMediaInput): Promise<SendResult>;

  /**
   * Configure phone number webhooks (auto-setup)
   */
  configureWebhook(input: ConfigureWebhookInput): Promise<{ success: boolean; error?: string }>;
}
