/**
 * MCP tool integration for Moltbot
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { MCPServersConfig } from "../config/types.mcp.js";
import { MCPClient } from "./client.js";
import { convertMCPTools } from "./schema-converter.js";
import type { MCPToolCallResult } from "./types.js";

interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// biome-ignore lint/suspicious/noExplicitAny: TypeBox schema type from pi-agent-core uses a different module instance.
type AnyAgentTool = AgentTool<any, unknown>;

/**
 * MCP client registry (singleton per server)
 */
const mcpClients = new Map<string, MCPClient>();

/**
 * Get or create MCP client for a server
 */
function getMCPClient(
  serverName: string,
  config: MCPServersConfig[string],
  logger: Logger,
): MCPClient {
  if (!mcpClients.has(serverName)) {
    const client = new MCPClient(config, logger);
    mcpClients.set(serverName, client);
  }
  return mcpClients.get(serverName)!;
}

/**
 * Fetch MCP tools and convert to Moltbot format
 */
export async function fetchMCPTools(
  servers: MCPServersConfig | undefined,
  agentName: string,
  workspace: string,
  sessionId: string,
  logger: Logger,
): Promise<AnyAgentTool[]> {
  // Feature flag check
  if (process.env.ENABLE_MCP !== "true") {
    return [];
  }

  if (!servers || Object.keys(servers).length === 0) {
    return [];
  }

  const allTools: AnyAgentTool[] = [];

  for (const [serverName, config] of Object.entries(servers)) {
    try {
      const client = getMCPClient(serverName, config, logger);

      // Connect if not already connected
      if (!client.isConnected()) {
        await client.connect();
      }

      // Register agent (with mutex protection)
      await client.registerAgent(agentName, workspace);

      // Get tools for this session (cached)
      const mcpTools = await client.getToolsForSession(sessionId);

      // Convert to Moltbot format
      const convertedSchemas = convertMCPTools(mcpTools, serverName);

      // Create AgentTool instances
      for (const schema of convertedSchemas) {
        const tool: AnyAgentTool = {
          name: schema.name,
          label: schema.name,
          description: schema.description,
          parameters: schema.input_schema as any,
          execute: async (
            _toolCallId: string,
            params: Record<string, unknown>,
            _signal?: AbortSignal,
          ) => {
            // Extract original tool name (remove server prefix)
            const originalName = schema.name.replace(`${serverName}__`, "");

            // Call MCP server
            const result: MCPToolCallResult = await client.callTool(originalName, params);

            // Convert result to AgentToolResult format
            if (result.isError) {
              return {
                content: [
                  {
                    type: "text",
                    text: result.content?.[0]?.text || "MCP tool error",
                  },
                ],
                details: { error: true, result },
              };
            }

            // Extract text from content array
            const textContent = result.content
              ?.filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n");

            return {
              content: [
                {
                  type: "text",
                  text: textContent || "MCP tool completed successfully",
                },
              ],
              details: result,
            };
          },
        };

        allTools.push(tool);
      }

      logger.info(`Loaded ${mcpTools.length} tools from MCP server: ${serverName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      logger.warn(`Failed to load tools from MCP server ${serverName}: ${message}`);
      // Continue to next server
    }
  }

  return allTools;
}

/**
 * Clear session cache for all MCP clients
 */
export function clearMCPSessionCache(sessionId: string): void {
  for (const client of mcpClients.values()) {
    client.clearSessionCache(sessionId);
  }
}
