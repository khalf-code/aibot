import { z } from "zod";

/**
 * MCP (Model Context Protocol) Integration Zod Schema
 *
 * Validates multi-tenant MCP configuration for HubSpot, BigQuery, Qdrant, and MongoDB integrations.
 */

const MCPServerConfigSchema = z
  .object({
    hubspot: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .strict()
      .optional(),
    bigquery: z
      .object({
        url: z.string().optional(),
      })
      .strict()
      .optional(),
    qdrant: z
      .object({
        url: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

const MCPCredentialConfigSchema = z
  .object({
    mongoUrl: z.string().optional(),
    database: z.string().optional(),
    collection: z.string().optional(),
  })
  .strict()
  .optional();

const MCPIntelligentDiscoverySchema = z
  .object({
    enabled: z.boolean().optional(),
    maxTools: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

export const MCPSchema = z
  .object({
    enabled: z.boolean().optional(),
    credentials: MCPCredentialConfigSchema,
    servers: MCPServerConfigSchema,
    isolationLevel: z
      .union([z.literal("organization"), z.literal("workspace"), z.literal("user")])
      .optional(),
    intelligentDiscovery: MCPIntelligentDiscoverySchema,
    toolTimeoutMs: z.number().int().nonnegative().optional(),
    autoRefresh: z.boolean().optional(),
  })
  .strict()
  .optional();
