/**
 * MCP HTTP Client with reconnection and caching
 */

import type { MCPServerConfig } from "../config/types.mcp.js";
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  MCPTool,
  MCPToolListResponse,
  MCPToolCallResult,
} from "./types.js";

interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export class MCPClient {
  private url: string;
  private headers: Record<string, string>;
  private timeoutMs: number;
  private logger: Logger;
  private connected = false;
  private maxRetries = 5;
  private sessionToolCache = new Map<string, MCPTool[]>();
  private registrationLock = new Map<string, Promise<void>>();
  private requestIdCounter = 0;

  constructor(config: MCPServerConfig, logger: Logger) {
    if (config.type !== "http") {
      throw new Error("Only HTTP MCP servers supported in this implementation");
    }

    if (!config.url) {
      throw new Error("HTTP MCP server requires url");
    }

    this.url = config.url;
    this.headers = {
      "Content-Type": "application/json",
      ...(config.headers || {}),
    };
    this.timeoutMs = config.timeoutMs || 5000;
    this.logger = logger;
  }

  /**
   * Generate unique request ID
   */
  private genId(): number {
    return ++this.requestIdCounter;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make JSON-RPC call with timeout
   */
  private async call(method: string, params?: unknown): Promise<JSONRPCResponse> {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: this.genId(),
      method,
      params,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: JSONRPCResponse = await response.json();
      return data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          throw new Error(`MCP request timeout after ${this.timeoutMs}ms`);
        }
        throw err;
      }
      throw new Error("Unknown error during MCP call");
    }
  }

  /**
   * Test connection to MCP server
   */
  async ping(): Promise<boolean> {
    try {
      // Try to list tools as a connectivity test
      await this.call("tools/list");
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Connect to MCP server with graceful degradation
   */
  async connect(): Promise<void> {
    try {
      const isAlive = await this.ping();
      if (isAlive) {
        this.connected = true;
        this.logger.info(`MCP server connected: ${this.url}`);
      } else {
        this.connected = false;
        this.logger.warn(`MCP server unreachable: ${this.url}`);
      }
    } catch (err) {
      this.connected = false;
      const message = err instanceof Error ? err.message : "unknown error";
      this.logger.warn(`MCP server connection failed: ${this.url} - ${message}`);
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  private async reconnect(attempt: number): Promise<void> {
    const delayMs = Math.min(1000 * 2 ** attempt, 30000);
    this.logger.warn(
      `MCP reconnecting in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
    );
    await this.sleep(delayMs);

    // Clear cache on reconnect
    this.sessionToolCache.clear();

    await this.connect();
  }

  /**
   * List available tools from MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      this.logger.warn("MCP server not connected, returning empty tool list");
      return [];
    }

    try {
      const response = await this.call("tools/list");

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.result as MCPToolListResponse;
      return result.tools || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      this.logger.error(`Failed to list MCP tools: ${message}`);

      // Try reconnection
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        await this.reconnect(attempt);
        if (this.connected) {
          try {
            const response = await this.call("tools/list");
            if (response.error) {
              throw new Error(response.error.message);
            }
            const result = response.result as MCPToolListResponse;
            return result.tools || [];
          } catch (retryErr) {
            // Continue to next retry
          }
        }
      }

      this.logger.error("MCP reconnection failed, returning empty tool list");
      return [];
    }
  }

  /**
   * Get tools for a specific session (with caching)
   */
  async getToolsForSession(sessionId: string): Promise<MCPTool[]> {
    if (!this.sessionToolCache.has(sessionId)) {
      const tools = await this.listTools();
      this.sessionToolCache.set(sessionId, tools);
    }
    return this.sessionToolCache.get(sessionId)!;
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: unknown): Promise<MCPToolCallResult> {
    if (!this.connected) {
      return {
        content: [
          {
            type: "text",
            text: `MCP server unreachable at ${this.url}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const response = await this.call("tools/call", {
        name,
        arguments: args,
      });

      if (response.error) {
        return {
          content: [
            {
              type: "text",
              text: `MCP tool error: ${response.error.message}`,
            },
          ],
          isError: true,
        };
      }

      return response.result as MCPToolCallResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      this.logger.error(`MCP tool call failed: ${message}`);

      return {
        content: [
          {
            type: "text",
            text: `MCP client error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Register agent with mutex to prevent concurrent registration
   */
  async registerAgent(agentName: string, workspace: string): Promise<void> {
    const key = agentName;

    // Wait for in-flight registration
    if (this.registrationLock.has(key)) {
      await this.registrationLock.get(key);
      return;
    }

    // Start new registration
    const promise = this._doRegister(agentName, workspace);
    this.registrationLock.set(key, promise);

    try {
      await promise;
    } finally {
      this.registrationLock.delete(key);
    }
  }

  /**
   * Internal registration implementation
   */
  private async _doRegister(agentName: string, workspace: string): Promise<void> {
    if (!this.connected) {
      this.logger.warn(`Cannot register agent ${agentName}: MCP server not connected`);
      return;
    }

    try {
      const response = await this.call("agent/register", {
        agentName,
        workspace,
      });

      if (response.error) {
        this.logger.error(`Agent registration failed: ${response.error.message}`);
      } else {
        this.logger.info(`Agent ${agentName} registered with MCP server`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      this.logger.warn(`Agent registration error: ${message}`);
    }
  }

  /**
   * Clear session cache for a specific session
   */
  clearSessionCache(sessionId: string): void {
    this.sessionToolCache.delete(sessionId);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
}
