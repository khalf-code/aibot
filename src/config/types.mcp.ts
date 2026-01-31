/**
 * MCP (Model Context Protocol) server configuration types
 */

export type MCPServerConfig = {
  type: "http" | "stdio";
  url?: string; // Required for HTTP
  headers?: Record<string, string>; // Optional auth headers
  command?: string; // Required for stdio
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number; // Default: 5000
};

export type MCPServersConfig = Record<string, MCPServerConfig>;

/**
 * Validate MCP server config
 */
export function validateMCPConfig(config: MCPServerConfig): string | null {
  if (config.type === "http") {
    if (!config.url) {
      return "HTTP MCP server requires 'url' field";
    }
    if (!config.url.startsWith("http://") && !config.url.startsWith("https://")) {
      return "MCP server URL must start with http:// or https://";
    }
  }

  if (config.type === "stdio") {
    if (!config.command) {
      return "stdio MCP server requires 'command' field";
    }
  }

  if (config.timeoutMs !== undefined && config.timeoutMs < 0) {
    return "timeoutMs must be non-negative";
  }

  return null;
}
