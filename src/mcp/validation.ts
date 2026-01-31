/**
 * MCP validation utilities
 */

import fs from "fs/promises";
import type { MCPServersConfig } from "../config/types.mcp.js";
import { MCPClient } from "./client.js";

interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

/**
 * Validate config file permissions (warn if insecure)
 */
export async function validateConfigSecurity(configPath: string, logger: Logger): Promise<void> {
  try {
    const stats = await fs.stat(configPath);
    const mode = stats.mode & 0o777;

    // Warn if not 600 or 400
    if (mode !== 0o600 && mode !== 0o400) {
      logger.warn(
        `WARNING: ${configPath} has insecure permissions ${mode.toString(8)}. ` +
          `Run: chmod 600 ${configPath}`,
      );
    }
  } catch (err) {
    // File doesn't exist or Windows - skip check
  }
}

/**
 * Detect tool name collisions across MCP servers
 */
export async function validateToolCollisions(
  servers: MCPServersConfig,
  logger: Logger,
): Promise<void> {
  const toolMap = new Map<string, string>();

  for (const [serverName, config] of Object.entries(servers)) {
    try {
      // Create temporary client
      const client = new MCPClient(config, logger);
      await client.connect();

      if (!client.isConnected()) {
        logger.warn(`Skipping collision check for offline server: ${serverName}`);
        continue;
      }

      // Fetch tools with timeout
      const tools = await Promise.race([
        client.listTools(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);

      // Check for collisions
      for (const tool of tools) {
        const fullName = `${serverName}__${tool.name}`;

        if (toolMap.has(fullName)) {
          logger.warn(
            `Tool collision: ${fullName} from ${serverName} and ${toolMap.get(fullName)}`,
          );
        }

        toolMap.set(fullName, serverName);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      logger.warn(`Failed to validate server ${serverName}: ${message}`);
    }
  }

  logger.info(`Validated ${toolMap.size} MCP tools from ${Object.keys(servers).length} servers`);
}
