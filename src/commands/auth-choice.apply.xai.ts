import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { normalizeApiKeyInput } from "./auth-choice.api-key.js";
import { applyAuthProfileConfig, applyXaiConfig, setXaiApiKey } from "./onboard-auth.js";

export async function applyAuthChoiceXAI(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  const { authChoice, config, agentDir } = params;

  if (authChoice === "xai-api-key") {
    const key = params.opts?.xaiApiKey;
    if (typeof key !== "string" || key.trim() === "") {
      return null;
    }

    let nextConfig = config;
    // Apply xAI config before auth profile config
    nextConfig = applyAuthProfileConfig(applyXaiConfig(nextConfig), {
      profileId: "xai:default",
      provider: "xai",
      mode: "api_key",
    });
    await setXaiApiKey(normalizeApiKeyInput(String(key)), agentDir);
    return { config: nextConfig };
  }

  return null;
}
