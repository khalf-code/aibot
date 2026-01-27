/**
 * SMS Outbound Message Adapter
 * Handles sending SMS and MMS messages
 */

import { getAccountState } from "./runtime.js";
import type { SMSResolvedAccount } from "./types.js";

export type OutboundContext = {
  to: string;
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  accountId: string;
  account: SMSResolvedAccount;
};

export type OutboundResult = {
  ok: boolean;
  externalId?: string;
  error?: string;
};

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters except leading +
  let normalized = phoneNumber.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    // Assume US number if 10 digits
    if (normalized.length === 10) {
      normalized = "+1" + normalized;
    } else {
      normalized = "+" + normalized;
    }
  }

  return normalized;
}

/**
 * Send SMS text message
 */
export async function sendText(ctx: OutboundContext): Promise<OutboundResult> {
  const state = getAccountState(ctx.accountId);
  if (!state?.provider) {
    return { ok: false, error: "SMS provider not initialized" };
  }

  if (!ctx.text) {
    return { ok: false, error: "No text content provided" };
  }

  const to = normalizePhoneNumber(ctx.to);
  const from = ctx.account.phoneNumber;

  const result = await state.provider.sendText({ from, to, text: ctx.text });

  return {
    ok: result.ok,
    externalId: result.messageId,
    error: result.error,
  };
}

/**
 * Send MMS with media attachments
 */
export async function sendMedia(ctx: OutboundContext): Promise<OutboundResult> {
  const state = getAccountState(ctx.accountId);
  if (!state?.provider) {
    return { ok: false, error: "SMS provider not initialized" };
  }

  const mediaUrls = ctx.mediaUrls || (ctx.mediaUrl ? [ctx.mediaUrl] : []);
  if (mediaUrls.length === 0) {
    return { ok: false, error: "No media URLs provided" };
  }

  const to = normalizePhoneNumber(ctx.to);
  const from = ctx.account.phoneNumber;

  const result = await state.provider.sendMedia({
    from,
    to,
    text: ctx.text,
    mediaUrls,
  });

  return {
    ok: result.ok,
    externalId: result.messageId,
    error: result.error,
  };
}

/**
 * Resolve target phone number
 */
export function resolveTarget(target: string): { ok: boolean; to?: string; error?: string } {
  if (!target) {
    return { ok: false, error: "No target provided" };
  }

  // Validate it looks like a phone number
  const digitsOnly = target.replace(/\D/g, "");
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return { ok: false, error: "Invalid phone number format" };
  }

  return { ok: true, to: normalizePhoneNumber(target) };
}

/**
 * Outbound adapter for Clawdbot channel plugin
 */
export const outboundAdapter = {
  deliveryMode: "gateway" as const,
  sendText,
  sendMedia,
  resolveTarget,
};
