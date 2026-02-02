/**
 * Hook to manage the gateway WebSocket connection.
 *
 * This hook initializes the gateway client and provides connection status.
 * It should be used at the app root to establish the connection.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getGatewayClient,
  type GatewayStatus,
  type GatewayEvent,
  type GatewayClientConfig,
  type GatewayHelloOk,
} from "@/lib/api";

export interface GapInfo {
  expected: number;
  received: number;
}

export interface UseGatewayConnectionOptions {
  /** Gateway WebSocket URL (defaults to ws://127.0.0.1:18789) */
  url?: string;
  /** Authentication token */
  token?: string;
  /** Password for authentication */
  password?: string;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Event handler */
  onEvent?: (event: GatewayEvent) => void;
  /** Gap detection handler */
  onGap?: (info: GapInfo) => void;
  /** Hello handler (called after successful connection) */
  onHello?: (hello: GatewayHelloOk) => void;
}

export interface UseGatewayConnectionResult {
  /** Current connection status */
  status: GatewayStatus;
  /** Whether connected */
  isConnected: boolean;
  /** Whether connecting */
  isConnecting: boolean;
  /** Connect to the gateway */
  connect: () => Promise<void>;
  /** Disconnect from the gateway */
  disconnect: () => void;
  /** Connection error if any */
  error: Error | null;
  /** Hello data from the gateway (features, auth info, etc.) */
  helloData: GatewayHelloOk | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Last gap info if any sequence gaps were detected */
  lastGap: GapInfo | null;
}

export function useGatewayConnection(
  options: UseGatewayConnectionOptions = {}
): UseGatewayConnectionResult {
  const { url, token, password, autoConnect = true, onEvent, onGap, onHello } = options;

  const [status, setStatus] = useState<GatewayStatus>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [helloData, setHelloData] = useState<GatewayHelloOk | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastGap, setLastGap] = useState<GapInfo | null>(null);
  const mountedRef = useRef(true);
  const wasConnectedRef = useRef(false);

  const connect = useCallback(async () => {
    const config: GatewayClientConfig = {
      url,
      token,
      password,
      onStatusChange: (newStatus) => {
        if (mountedRef.current) {
          setStatus(newStatus);

          // Track reconnection attempts
          if (newStatus === "connecting" && wasConnectedRef.current) {
            setReconnectAttempts((prev) => prev + 1);
          }

          if (newStatus === "connected") {
            wasConnectedRef.current = true;
          }
        }
      },
      onEvent,
      onError: (err) => {
        if (mountedRef.current) {
          setError(err);
        }
      },
      onHello: (hello) => {
        if (mountedRef.current) {
          setHelloData(hello);
          setReconnectAttempts(0); // Reset on successful connection
          onHello?.(hello);
        }
      },
      onGap: (info) => {
        if (mountedRef.current) {
          setLastGap(info);
          onGap?.(info);
        }
      },
    };

    const client = getGatewayClient(config);

    try {
      setError(null);
      await client.connect();
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [url, token, password, onEvent, onGap, onHello]);

  const disconnect = useCallback(() => {
    const client = getGatewayClient();
    client.stop();
    setStatus("disconnected");
    setHelloData(null);
    wasConnectedRef.current = false;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      const timer = window.setTimeout(() => {
        void connect();
      }, 0);

      return () => {
        window.clearTimeout(timer);
        mountedRef.current = false;
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoConnect, connect]);

  return {
    status,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    connect,
    disconnect,
    error,
    helloData,
    reconnectAttempts,
    lastGap,
  };
}

export default useGatewayConnection;
