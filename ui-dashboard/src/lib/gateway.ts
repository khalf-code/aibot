import { useSyncExternalStore } from 'react';

const DEFAULT_URL = 'ws://localhost:18789';

// Connection state store (separate from Zustand to avoid re-render loops)
let connectionState = {
  connected: false,
  connecting: false,
  error: null as string | null,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function setConnectionState(updates: Partial<typeof connectionState>) {
  connectionState = { ...connectionState, ...updates };
  notify();
}

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type EventHandler = (event: string, payload: unknown) => void;

let nextId = 0;
function generateId(): string {
  return `dash-${++nextId}-${Date.now().toString(36)}`;
}

class GatewayManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private url = DEFAULT_URL;
  private reconnectInterval = 3000;
  private maxReconnectAttempts = 10;
  private pending = new Map<string, PendingRequest>();
  private eventHandlers = new Set<EventHandler>();
  private handshakeComplete = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = true;
    this.handshakeComplete = false;
    setConnectionState({ connecting: true, error: null });

    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.sendHandshake();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          this.handleFrame(data);
        } catch (err) {
          console.error('[Gateway] Failed to parse message:', err);
        }
      };

      ws.onerror = () => {
        setConnectionState({ error: 'WebSocket connection error', connecting: false });
      };

      ws.onclose = () => {
        this.handshakeComplete = false;
        setConnectionState({ connected: false, connecting: false });
        this.ws = null;

        // Reject all pending requests
        for (const [id, req] of this.pending) {
          clearTimeout(req.timer);
          req.reject(new Error('Connection closed'));
          this.pending.delete(id);
        }

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 3);

          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          setConnectionState({ error: `Failed to connect after ${this.maxReconnectAttempts} attempts` });
        }
      };
    } catch (err) {
      setConnectionState({
        error: err instanceof Error ? err.message : 'Failed to connect',
        connecting: false,
      });
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.handshakeComplete = false;
    setConnectionState({ connected: false, connecting: false });
    this.reconnectAttempts = 0;
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  callMethod(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.handshakeComplete) {
        reject(new Error('Not connected'));
        return;
      }

      const id = generateId();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30_000);

      this.pending.set(id, { resolve, reject, timer });

      this.ws.send(
        JSON.stringify({
          type: 'req',
          id,
          method,
          params,
        }),
      );
    });
  }

  private sendHandshake() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const id = generateId();
    const timer = setTimeout(() => {
      this.pending.delete(id);
      setConnectionState({
        error: 'Handshake timeout',
        connecting: false,
      });
      this.ws?.close();
    }, 10_000);

    this.pending.set(id, {
      resolve: () => {
        this.handshakeComplete = true;
        setConnectionState({ connected: true, connecting: false, error: null });
        this.onConnected();
      },
      reject: (err: Error) => {
        setConnectionState({
          error: `Handshake failed: ${err.message}`,
          connecting: false,
        });
        this.ws?.close();
      },
      timer,
    });

    this.ws.send(
      JSON.stringify({
        type: 'req',
        id,
        method: 'connect',
        params: {
          minProtocol: 1,
          maxProtocol: 1,
          client: {
            id: 'openclaw-dashboard',
            displayName: 'OpenClaw Dashboard',
            version: '0.0.1',
          },
          role: 'operator',
          scopes: ['operator.admin'],
        },
      }),
    );
  }

  private onConnected() {
    // Load initial snapshot after handshake
    this.callMethod('dashboard.snapshot', {}).then(
      (data) => {
        import('../stores/dashboardStore').then(({ useDashboardStore }) => {
          useDashboardStore.getState().applySnapshot(data as Record<string, unknown>);
        });
      },
      (err) => {
        console.warn('[Gateway] Failed to load snapshot:', err);
      },
    );
  }

  private handleFrame(frame: { type: string; id?: string; ok?: boolean; payload?: unknown; error?: { message?: string }; event?: string }) {
    if (frame.type === 'res' && frame.id) {
      const req = this.pending.get(frame.id);
      if (req) {
        clearTimeout(req.timer);
        this.pending.delete(frame.id);
        if (frame.ok) {
          req.resolve(frame.payload);
        } else {
          req.reject(new Error(frame.error?.message ?? 'Request failed'));
        }
      }
      return;
    }

    if (frame.type === 'event') {
      // Ignore connect.challenge — handshake handles auth
      if (frame.event === 'connect.challenge') return;

      // Route events to handlers
      for (const handler of this.eventHandlers) {
        try {
          handler(frame.event!, frame.payload);
        } catch (err) {
          console.error('[Gateway] Event handler error:', err);
        }
      }

      // Also route dashboard.* events to the store
      if (frame.event?.startsWith('dashboard.')) {
        import('../stores/dashboardStore').then(({ useDashboardStore }) => {
          useDashboardStore.getState().handleGatewayEvent({
            type: frame.event as string,
            timestamp: Date.now(),
            payload: frame.payload,
          });
        });
      }
      return;
    }
  }
}

// Singleton instance
export const gateway = new GatewayManager();

// React hook using useSyncExternalStore
export function useGateway() {
  const state = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => connectionState,
    () => connectionState,
  );

  return {
    ...state,
    connect: () => gateway.connect(),
    disconnect: () => gateway.disconnect(),
  };
}

export function useSendMessage() {
  return (content: string, trackId?: string) => {
    return gateway.callMethod('dashboard.message.send', { content, trackId });
  };
}

// Auto-connect in browser
let autoConnectAttempted = false;
export function initGateway() {
  if (!autoConnectAttempted && typeof window !== 'undefined') {
    autoConnectAttempted = true;
    setTimeout(() => gateway.connect(), 100);
  }
}
