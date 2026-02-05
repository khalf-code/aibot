import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { loadConfig } from "../../config/config.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import { loadModelCatalog } from "../model-catalog.js";
import {
  buildAllowedModelSet,
  buildModelAliasIndex,
  modelKey,
  normalizeProviderId,
  resolveDefaultModelForAgent,
} from "../model-selection.js";
import { jsonResult } from "./common.js";
import { resolveInternalSessionKey, resolveMainSessionAlias } from "./sessions-helpers.js";

const ModelsListToolSchema = Type.Object({
  filter: Type.Optional(
    Type.String({
      description: "Optional filter: 'allowed' (default), 'all', or 'primary'",
    }),
  ),
});

type ModelListEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: Array<"text" | "image">;
  alias?: string;
  isPrimary: boolean;
  isAllowed: boolean;
};

export function createModelsListTool(opts?: {
  agentSessionKey?: string;
  config?: OpenClawConfig;
}): AnyAgentTool {
  return {
    label: "Models",
    name: "models_list",
    description:
      "List available AI models that can be used with sessions_spawn. Use to discover which models are available for sub-agent tasks. Filter: 'allowed' (default - only models you can use), 'all' (all discovered models), 'primary' (just the current default).",
    parameters: ModelsListToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const filter = String(params.filter ?? "allowed").toLowerCase();
      const cfg = opts?.config ?? loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);

      // Resolve the agent ID from the session key
      const requesterSessionKey = opts?.agentSessionKey;
      const requesterInternalKey =
        typeof requesterSessionKey === "string" && requesterSessionKey.trim()
          ? resolveInternalSessionKey({
              key: requesterSessionKey,
              alias,
              mainKey,
            })
          : alias;
      const agentId = normalizeAgentId(
        parseAgentSessionKey(requesterInternalKey)?.agentId ?? "default",
      );

      // Get the default model for this agent
      const defaultModel = resolveDefaultModelForAgent({ cfg, agentId });
      const primaryKey = modelKey(defaultModel.provider, defaultModel.model);

      // Load the model catalog
      const catalog = await loadModelCatalog({ config: cfg });

      // Build allowed model set
      const allowed = buildAllowedModelSet({
        cfg,
        catalog,
        defaultProvider: defaultModel.provider,
        defaultModel: defaultModel.model,
      });

      // Build alias index
      const aliasIndex = buildModelAliasIndex({
        cfg,
        defaultProvider: defaultModel.provider,
      });

      // Build response based on filter
      const entries: ModelListEntry[] = [];

      for (const entry of catalog) {
        const key = modelKey(entry.provider, entry.id);
        const isPrimary = key === primaryKey;
        const isAllowed = allowed.allowAny || allowed.allowedKeys.has(key);

        // Skip if filtering to allowed only and this isn't allowed
        if (filter === "allowed" && !isAllowed) {
          continue;
        }

        // Skip if filtering to primary only and this isn't primary
        if (filter === "primary" && !isPrimary) {
          continue;
        }

        // Find alias for this model
        const aliases = aliasIndex.byKey.get(key) ?? [];
        const alias = aliases[0];

        entries.push({
          id: entry.id,
          name: entry.name,
          provider: entry.provider,
          contextWindow: entry.contextWindow,
          reasoning: entry.reasoning,
          input: entry.input,
          alias,
          isPrimary,
          isAllowed,
        });
      }

      // Sort: primary first, then allowed, then by provider/name
      entries.sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) {
          return -1;
        }
        if (!a.isPrimary && b.isPrimary) {
          return 1;
        }
        if (a.isAllowed && !b.isAllowed) {
          return -1;
        }
        if (!a.isAllowed && b.isAllowed) {
          return 1;
        }
        const p = a.provider.localeCompare(b.provider);
        if (p !== 0) return p;
        return a.name.localeCompare(b.name);
      });

      return jsonResult({
        primary: primaryKey,
        allowAny: allowed.allowAny,
        count: entries.length,
        models: entries.map((e) => ({
          ref: `${e.provider}/${e.id}`,
          name: e.name,
          provider: e.provider,
          contextWindow: e.contextWindow,
          reasoning: e.reasoning,
          vision: e.input?.includes("image") ?? false,
          alias: e.alias,
          isPrimary: e.isPrimary,
          isAllowed: e.isAllowed,
        })),
      });
    },
  };
}
