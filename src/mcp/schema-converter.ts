/**
 * Convert MCP tool schemas to Anthropic SDK format
 */

import type { MCPTool } from "./types.js";

/**
 * Convert MCP JSON Schema to Anthropic SDK tool format
 */
export function convertMCPToolSchema(
  mcpTool: MCPTool,
  serverName: string,
): {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
} {
  // Namespace the tool name with server name to avoid collisions
  const toolName = `${serverName}__${mcpTool.name}`;

  return {
    name: toolName,
    description: mcpTool.description || `Tool from MCP server: ${serverName}`,
    input_schema: {
      type: "object",
      properties: mcpTool.inputSchema.properties || {},
      required: mcpTool.inputSchema.required || [],
    },
  };
}

/**
 * Convert multiple MCP tools to Anthropic format
 */
export function convertMCPTools(
  tools: MCPTool[],
  serverName: string,
): Array<{
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}> {
  return tools.map((tool) => convertMCPToolSchema(tool, serverName));
}
