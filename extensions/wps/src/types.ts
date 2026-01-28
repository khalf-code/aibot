import { z } from "zod";

/**
 * DM policy for WPS channel
 * - "open": Accept messages from anyone
 * - "allowlist": Only accept messages from users in allowFrom list
 * - "pairing": Require pairing code for new users (default)
 */
export const WpsDmPolicySchema = z.enum(["open", "allowlist", "pairing"]).default("pairing");

/**
 * Group configuration for WPS
 */
export const WpsGroupConfigSchema = z.object({
  requireMention: z.boolean().optional().describe("Require @mention to trigger in this group"),
  toolPolicy: z.enum(["full", "limited", "none"]).optional().describe("Tool access policy for this group"),
}).passthrough();

export const WpsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  appId: z.string().describe("WPS App ID (client_id)"),
  appSecret: z.string().describe("WPS App Secret (client_secret)"),
  companyId: z.string().describe("WPS Company ID"),
  baseUrl: z.string().default("https://openapi.wps.cn").describe("WPS API Base URL"),
  enableEncryption: z.boolean().default(true).describe("Enable event encryption/decryption"),
  webhook: z.object({
    path: z.string().default("/wps/webhook"),
    port: z.number().default(3000),
  }).optional(),
  dmPolicy: WpsDmPolicySchema.optional().describe("DM access policy: open, allowlist, or pairing"),
  allowFrom: z.array(z.string()).optional().describe("List of allowed user IDs"),
  groups: z.record(z.string(), WpsGroupConfigSchema).optional().describe("Group-specific configurations"),
  groupPolicy: z.enum(["open", "allowlist"]).optional().describe("Group access policy"),
});

export type WpsConfig = z.infer<typeof WpsConfigSchema>;
export type WpsDmPolicy = z.infer<typeof WpsDmPolicySchema>;
export type WpsGroupConfig = z.infer<typeof WpsGroupConfigSchema>;

export type WpsCredentials = {
  appId: string;
  appSecret: string;
  companyId: string;
  baseUrl: string;
};
