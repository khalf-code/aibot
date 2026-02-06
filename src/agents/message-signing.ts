/**
 * Message signing for owner message verification.
 *
 * Uses @disreguard/sig ContentStore to sign messages from authenticated
 * channels, allowing the LLM to verify message provenance via the verify tool.
 */

import { createContentStore, type ContentStore } from "@disreguard/sig";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agents/message-signing");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageSigningContext {
  store: ContentStore;
  sessionId: string;
}

export interface SignMessageParams {
  messageId: string;
  content: string;
  channel: string;
  senderId: string;
  senderName?: string;
  senderE164?: string;
  isOwner: boolean;
  groupId?: string | null;
}

// ---------------------------------------------------------------------------
// Store Management
// ---------------------------------------------------------------------------

const sessionStores = new Map<string, MessageSigningContext>();

/**
 * Create or retrieve a message signing context for a session.
 * Session-scoped: the ContentStore persists across turns within a session.
 */
export function createMessageSigningContext(sessionId: string): MessageSigningContext {
  const existing = sessionStores.get(sessionId);
  if (existing) {
    return existing;
  }
  const store = createContentStore();
  const ctx: MessageSigningContext = { store, sessionId };
  sessionStores.set(sessionId, ctx);
  log.debug(`Created message signing context for session: ${sessionId}`);
  return ctx;
}

/**
 * Clear a session's message signing context (e.g., on session end).
 */
export function clearMessageSigningContext(sessionId: string): void {
  sessionStores.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Message ID
// ---------------------------------------------------------------------------

/**
 * Build a namespaced message signature ID to avoid cross-channel collisions.
 */
export function buildMessageSignatureId(
  sessionId: string,
  channel: string,
  messageId: string,
): string {
  return `${sessionId}:${channel}:${messageId}`;
}

// ---------------------------------------------------------------------------
// Message Signing
// ---------------------------------------------------------------------------

/**
 * Sign a message from an authenticated owner channel.
 * Only signs when `isOwner` is true.
 */
export function signMessage(ctx: MessageSigningContext, params: SignMessageParams): boolean {
  if (!params.isOwner) {
    return false;
  }

  const sigId = buildMessageSignatureId(ctx.sessionId, params.channel, params.messageId);
  const identity = buildSenderIdentity(params);

  try {
    ctx.store.sign(params.content, {
      id: sigId,
      identity,
      metadata: {
        channel: params.channel,
        senderId: params.senderId,
        ...(params.senderName ? { senderName: params.senderName } : {}),
        ...(params.senderE164 ? { senderE164: params.senderE164 } : {}),
        ...(params.groupId ? { groupId: params.groupId } : {}),
      },
    });
    log.debug(`Signed message ${sigId} from ${identity}`);
    return true;
  } catch (err) {
    log.warn(`Failed to sign message ${sigId}: ${String(err)}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSenderIdentity(params: SignMessageParams): string {
  const parts = ["owner"];
  if (params.senderE164) {
    parts.push(params.senderE164);
  } else if (params.senderId) {
    parts.push(params.senderId);
  }
  parts.push(params.channel);
  return parts.join(":");
}
