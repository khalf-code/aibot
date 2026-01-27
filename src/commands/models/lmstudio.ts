import * as clack from "@clack/prompts";

import { discoverLMStudioModels } from "../../agents/models-config.providers.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";
import { logConfigUpdated } from "../../config/logging.js";
import type { RuntimeEnv } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { updateConfig } from "./shared.js";

const DEFAULT_LMSTUDIO_URL = "http://127.0.0.1:1234/v1";

export interface LMStudioSetupOptions {
  url?: string;
  setDefault?: boolean;
  yes?: boolean;
}

export async function modelsLMStudioSetupCommand(
  opts: LMStudioSetupOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  let baseUrl = opts.url ?? process.env.LMSTUDIO_BASE_URL ?? DEFAULT_LMSTUDIO_URL;

  // If no URL provided and not --yes, prompt for it
  if (!opts.url && !opts.yes) {
    const urlInput = await clack.text({
      message: "LM Studio server URL",
      placeholder: DEFAULT_LMSTUDIO_URL,
      defaultValue: DEFAULT_LMSTUDIO_URL,
      validate: (value) => {
        try {
          new URL(value);
          return undefined;
        } catch {
          return "Invalid URL";
        }
      },
    });
    if (clack.isCancel(urlInput)) {
      clack.cancel("Setup cancelled");
      return;
    }
    baseUrl = urlInput || DEFAULT_LMSTUDIO_URL;
  }

  // Discover models
  const spinner = clack.spinner();
  spinner.start(`Discovering models at ${baseUrl}...`);

  const models = await discoverLMStudioModels(baseUrl);

  if (models.length === 0) {
    spinner.stop(`${theme.error("No models found")} at ${baseUrl}`);
    runtime.log(theme.muted("\nMake sure LM Studio is running and has a model loaded."));
    runtime.log(theme.muted(`Test with: curl ${baseUrl}/models`));
    return;
  }

  spinner.stop(`Found ${models.length} model(s)`);

  // Display discovered models
  runtime.log("");
  for (const model of models) {
    const tags: string[] = [];
    if (model.reasoning) tags.push("reasoning");
    if (model.input?.includes("image")) tags.push("vision");
    const tagStr = tags.length > 0 ? ` ${theme.muted(`(${tags.join(", ")})`)}` : "";
    runtime.log(`  ${theme.success("+")} ${model.id}${tagStr}`);
  }
  runtime.log("");

  // Select default model
  let selectedModel: ModelDefinitionConfig | undefined;
  if (!opts.yes && models.length > 1) {
    const modelOptions = models.map((m) => ({
      value: m.id,
      label: m.id,
      hint: m.reasoning ? "reasoning" : undefined,
    }));

    const selected = await clack.select({
      message: "Select default model",
      options: modelOptions,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Setup cancelled");
      return;
    }

    selectedModel = models.find((m) => m.id === selected);
  } else {
    selectedModel = models[0];
  }

  // Build provider config
  const providerConfig = {
    baseUrl,
    apiKey: "lmstudio",
    api: "openai-completions" as const,
    models,
  };

  // Update config
  const updated = await updateConfig((cfg) => {
    const nextConfig = {
      ...cfg,
      models: {
        ...cfg.models,
        mode: cfg.models?.mode ?? "merge",
        providers: {
          ...cfg.models?.providers,
          lmstudio: providerConfig,
        },
      },
    };

    // Set as default if requested
    if (opts.setDefault && selectedModel) {
      const modelId = `lmstudio/${selectedModel.id}`;
      const existingModel = cfg.agents?.defaults?.model as
        | { primary?: string; fallbacks?: string[] }
        | undefined;
      nextConfig.agents = {
        ...nextConfig.agents,
        defaults: {
          ...nextConfig.agents?.defaults,
          model: {
            ...(existingModel?.fallbacks ? { fallbacks: existingModel.fallbacks } : undefined),
            primary: modelId,
          },
        },
      };
    }

    return nextConfig;
  });

  logConfigUpdated(runtime);

  if (selectedModel) {
    const modelId = `lmstudio/${selectedModel.id}`;
    if (opts.setDefault) {
      runtime.log(`Default model: ${theme.accent(modelId)}`);
    } else {
      runtime.log(theme.muted(`\nTo set as default: clawdbot models set ${modelId}`));
    }
  }

  // Show discovered models summary
  runtime.log(
    theme.muted(`\nConfigured ${models.length} model(s) from ${baseUrl}`),
  );
}

export async function modelsLMStudioDiscoverCommand(
  opts: { url?: string; json?: boolean },
  runtime: RuntimeEnv,
): Promise<void> {
  const baseUrl = opts.url ?? process.env.LMSTUDIO_BASE_URL ?? DEFAULT_LMSTUDIO_URL;
  const models = await discoverLMStudioModels(baseUrl);

  if (opts.json) {
    runtime.log(JSON.stringify({ baseUrl, models }, null, 2));
    return;
  }

  if (models.length === 0) {
    runtime.log(theme.error(`No models found at ${baseUrl}`));
    runtime.log(theme.muted(`\nMake sure LM Studio is running and has a model loaded.`));
    return;
  }

  runtime.log(`Models at ${theme.accent(baseUrl)}:\n`);
  for (const model of models) {
    const tags: string[] = [];
    if (model.reasoning) tags.push("reasoning");
    if (model.input?.includes("image")) tags.push("vision");
    const tagStr = tags.length > 0 ? ` ${theme.muted(`(${tags.join(", ")})`)}` : "";
    runtime.log(`  ${model.id}${tagStr}`);
  }
}
