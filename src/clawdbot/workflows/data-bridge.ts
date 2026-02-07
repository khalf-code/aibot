/**
 * WF-008 (#59) — Data bridge
 *
 * Message types and interface for bidirectional communication between
 * the Clawdbot runtime and the embedded n8n workflow engine. The data
 * bridge uses a lightweight pub/sub pattern so workflow nodes can push
 * data to Clawdbot (e.g. approval requests, artifact uploads) and
 * Clawdbot can push events back (e.g. approval decisions, config updates).
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/**
 * Message direction / category.
 *
 * - "workflow_event" — n8n -> Clawdbot (node executed, workflow completed, etc.)
 * - "approval_request" — n8n -> Clawdbot (approval gate reached)
 * - "approval_decision" — Clawdbot -> n8n (approval granted/denied)
 * - "trigger_signal" — Clawdbot -> n8n (manual or event-driven start)
 * - "artifact_upload" — n8n -> Clawdbot (file / screenshot generated)
 * - "config_sync" — Clawdbot -> n8n (credential or setting update)
 */
export type BridgeMessageType =
  | "workflow_event"
  | "approval_request"
  | "approval_decision"
  | "trigger_signal"
  | "artifact_upload"
  | "config_sync";

/** A single message passed across the data bridge. */
export type DataBridgeMessage = {
  /** Message category. */
  type: BridgeMessageType;
  /** The n8n workflow ID this message relates to. */
  workflowId: string;
  /** The specific execution / run ID (may be empty for config_sync). */
  runId: string;
  /** Arbitrary payload; shape depends on `type`. */
  payload: Record<string, unknown>;
  /** Unix epoch milliseconds when the message was created. */
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Subscription callback
// ---------------------------------------------------------------------------

export type BridgeSubscriber = (message: DataBridgeMessage) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Data bridge interface
// ---------------------------------------------------------------------------

/** Bidirectional communication channel between Clawdbot and n8n. */
export type DataBridge = {
  /** Send a message from Clawdbot into the n8n runtime. */
  sendToN8n(message: DataBridgeMessage): Promise<void>;
  /** Send a message from n8n back to the Clawdbot runtime. */
  receiveFromN8n(message: DataBridgeMessage): Promise<void>;
  /**
   * Subscribe to messages of a given type. Returns an unsubscribe function.
   * When `type` is omitted, the subscriber receives all message types.
   */
  subscribe(subscriber: BridgeSubscriber, type?: BridgeMessageType): () => void;
};

// ---------------------------------------------------------------------------
// In-memory stub implementation
// ---------------------------------------------------------------------------

/**
 * Simple in-memory data bridge for development and testing.
 * Replace with a Redis pub/sub or WebSocket transport for production.
 */
export class InMemoryDataBridge implements DataBridge {
  private subscribers: Array<{ fn: BridgeSubscriber; type?: BridgeMessageType }> = [];

  async sendToN8n(message: DataBridgeMessage): Promise<void> {
    // TODO: forward to n8n webhook endpoint or internal API
    await this.dispatch(message);
  }

  async receiveFromN8n(message: DataBridgeMessage): Promise<void> {
    await this.dispatch(message);
  }

  subscribe(subscriber: BridgeSubscriber, type?: BridgeMessageType): () => void {
    const entry = { fn: subscriber, type };
    this.subscribers.push(entry);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== entry);
    };
  }

  private async dispatch(message: DataBridgeMessage): Promise<void> {
    for (const sub of this.subscribers) {
      if (!sub.type || sub.type === message.type) {
        await sub.fn(message);
      }
    }
  }
}
