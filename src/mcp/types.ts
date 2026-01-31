/**
 * MCP JSON-RPC types
 */

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP Tool Schema (JSON Schema format from MCP server)
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * MCP Tool List Response
 */
export interface MCPToolListResponse {
  tools: MCPTool[];
}

/**
 * MCP Tool Call Result
 */
export interface MCPToolCallResult {
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
}
