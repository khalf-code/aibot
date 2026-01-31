import { MarkdownConfigSchema } from "openclaw/plugin-sdk";
import { z } from "zod";

const allowFromEntry = z.union([z.string(), z.number()]);

const mezonAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema,
  botId: z.string().optional(),
  botToken: z.string().optional(),
  tokenFile: z.string().optional(),
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(allowFromEntry).optional(),
  mediaMaxMb: z.number().optional(),
  host: z.string().optional(),
  port: z.string().optional(),
  useSSL: z.boolean().optional(),
});

export const MezonConfigSchema = mezonAccountSchema.extend({
  accounts: z.object({}).catchall(mezonAccountSchema).optional(),
  defaultAccount: z.string().optional(),
});
