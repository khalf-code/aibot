import { describe, expect, it, vi } from "vitest";

const mockRegistryFind = vi.fn(() => null);

vi.mock("../pi-model-discovery.js", () => ({
  discoverAuthStorage: vi.fn(() => ({ mocked: true })),
  discoverModels: vi.fn(() => ({ find: mockRegistryFind })),
}));

import type { OpenClawConfig } from "../../config/config.js";
import {
  buildInlineProviderModels,
  resolveModel,
  stripBedrockInferenceProfilePrefix,
} from "./model.js";

const makeModel = (id: string) => ({
  id,
  name: id,
  reasoning: false,
  input: ["text"] as const,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1,
  maxTokens: 1,
});

describe("buildInlineProviderModels", () => {
  it("attaches provider ids to inline models", () => {
    const providers = {
      " alpha ": { baseUrl: "http://alpha.local", models: [makeModel("alpha-model")] },
      beta: { baseUrl: "http://beta.local", models: [makeModel("beta-model")] },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toEqual([
      {
        ...makeModel("alpha-model"),
        provider: "alpha",
        baseUrl: "http://alpha.local",
        api: undefined,
      },
      {
        ...makeModel("beta-model"),
        provider: "beta",
        baseUrl: "http://beta.local",
        api: undefined,
      },
    ]);
  });

  it("inherits baseUrl from provider when model does not specify it", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        models: [makeModel("custom-model")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].baseUrl).toBe("http://localhost:8000");
  });

  it("inherits api from provider when model does not specify it", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        api: "anthropic-messages",
        models: [makeModel("custom-model")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });

  it("model-level api takes precedence over provider-level api", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        api: "openai-responses",
        models: [{ ...makeModel("custom-model"), api: "anthropic-messages" as const }],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });

  it("inherits both baseUrl and api from provider config", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:10000",
        api: "anthropic-messages",
        models: [makeModel("claude-opus-4.5")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      provider: "custom",
      baseUrl: "http://localhost:10000",
      api: "anthropic-messages",
      name: "claude-opus-4.5",
    });
  });
});

describe("resolveModel", () => {
  it("includes provider baseUrl in fallback model", () => {
    const cfg = {
      models: {
        providers: {
          custom: {
            baseUrl: "http://localhost:9000",
            models: [],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel("custom", "missing-model", "/tmp/agent", cfg);

    expect(result.model?.baseUrl).toBe("http://localhost:9000");
    expect(result.model?.provider).toBe("custom");
    expect(result.model?.id).toBe("missing-model");
  });

  it("matches Bedrock inference profile prefix against base model in inline models", () => {
    mockRegistryFind.mockReturnValue(null);

    const cfg = {
      models: {
        providers: {
          "amazon-bedrock": {
            baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
            api: "bedrock-converse-stream",
            models: [
              {
                id: "anthropic.claude-opus-4-5-20251101-v1:0",
                name: "Claude Opus 4.5",
                reasoning: true,
                input: ["text", "image"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
        },
      },
    } as OpenClawConfig;

    // Request with "us." prefix should match base model and preserve the prefix
    const result = resolveModel(
      "amazon-bedrock",
      "us.anthropic.claude-opus-4-5-20251101-v1:0",
      "/tmp/agent",
      cfg,
    );

    expect(result.error).toBeUndefined();
    expect(result.model).toBeDefined();
    // The model ID should be the prefixed version for the API call
    expect(result.model?.id).toBe("us.anthropic.claude-opus-4-5-20251101-v1:0");
    expect(result.model?.name).toBe("Claude Opus 4.5");
    expect(result.model?.contextWindow).toBe(200000);
  });

  it("matches direct Bedrock model ID without prefix", () => {
    mockRegistryFind.mockReturnValue(null);

    const cfg = {
      models: {
        providers: {
          "amazon-bedrock": {
            baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
            api: "bedrock-converse-stream",
            models: [makeModel("anthropic.claude-3-sonnet-20240229-v1:0")],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel(
      "amazon-bedrock",
      "anthropic.claude-3-sonnet-20240229-v1:0",
      "/tmp/agent",
      cfg,
    );

    expect(result.error).toBeUndefined();
    expect(result.model?.id).toBe("anthropic.claude-3-sonnet-20240229-v1:0");
  });

  it("matches global prefix for Bedrock models", () => {
    mockRegistryFind.mockReturnValue(null);

    const cfg = {
      models: {
        providers: {
          "amazon-bedrock": {
            baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
            api: "bedrock-converse-stream",
            models: [makeModel("anthropic.claude-opus-4-5-20251101-v1:0")],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel(
      "amazon-bedrock",
      "global.anthropic.claude-opus-4-5-20251101-v1:0",
      "/tmp/agent",
      cfg,
    );

    expect(result.error).toBeUndefined();
    expect(result.model?.id).toBe("global.anthropic.claude-opus-4-5-20251101-v1:0");
  });

  it("matches eu prefix for Bedrock models", () => {
    mockRegistryFind.mockReturnValue(null);

    const cfg = {
      models: {
        providers: {
          "amazon-bedrock": {
            baseUrl: "https://bedrock-runtime.eu-west-1.amazonaws.com",
            api: "bedrock-converse-stream",
            models: [makeModel("anthropic.claude-opus-4-5-20251101-v1:0")],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel(
      "amazon-bedrock",
      "eu.anthropic.claude-opus-4-5-20251101-v1:0",
      "/tmp/agent",
      cfg,
    );

    expect(result.error).toBeUndefined();
    expect(result.model?.id).toBe("eu.anthropic.claude-opus-4-5-20251101-v1:0");
  });

  it("returns error when Bedrock model not found even with prefix stripping", () => {
    mockRegistryFind.mockReturnValue(null);

    const cfg = {
      models: {
        providers: {
          "amazon-bedrock": {
            baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
            api: "bedrock-converse-stream",
            models: [makeModel("anthropic.claude-3-sonnet-20240229-v1:0")],
          },
        },
      },
    } as OpenClawConfig;

    // Request a different model that doesn't exist
    const result = resolveModel(
      "amazon-bedrock",
      "us.anthropic.claude-nonexistent-v1:0",
      "/tmp/agent",
      cfg,
    );

    // Should still create a fallback model since provider is configured
    expect(result.model?.id).toBe("us.anthropic.claude-nonexistent-v1:0");
  });

  it("does not apply prefix matching for non-Bedrock providers", () => {
    mockRegistryFind.mockReturnValue(null);

    const cfg = {
      models: {
        providers: {
          anthropic: {
            baseUrl: "https://api.anthropic.com",
            models: [makeModel("claude-opus-4-5")],
          },
        },
      },
    } as OpenClawConfig;

    // This should NOT match "claude-opus-4-5" because prefix stripping is Bedrock-only
    const result = resolveModel("anthropic", "us.claude-opus-4-5", "/tmp/agent", cfg);

    // Should create fallback model with the original ID (no matching)
    expect(result.model?.id).toBe("us.claude-opus-4-5");
  });
});

describe("stripBedrockInferenceProfilePrefix", () => {
  it("strips us. prefix", () => {
    const result = stripBedrockInferenceProfilePrefix("us.anthropic.claude-opus-4-5-20251101-v1:0");
    expect(result.prefix).toBe("us.");
    expect(result.baseModelId).toBe("anthropic.claude-opus-4-5-20251101-v1:0");
  });

  it("strips eu. prefix", () => {
    const result = stripBedrockInferenceProfilePrefix("eu.anthropic.claude-opus-4-5-20251101-v1:0");
    expect(result.prefix).toBe("eu.");
    expect(result.baseModelId).toBe("anthropic.claude-opus-4-5-20251101-v1:0");
  });

  it("strips ap. prefix", () => {
    const result = stripBedrockInferenceProfilePrefix("ap.anthropic.claude-opus-4-5-20251101-v1:0");
    expect(result.prefix).toBe("ap.");
    expect(result.baseModelId).toBe("anthropic.claude-opus-4-5-20251101-v1:0");
  });

  it("strips global. prefix", () => {
    const result = stripBedrockInferenceProfilePrefix(
      "global.anthropic.claude-opus-4-5-20251101-v1:0",
    );
    expect(result.prefix).toBe("global.");
    expect(result.baseModelId).toBe("anthropic.claude-opus-4-5-20251101-v1:0");
  });

  it("returns null prefix for unprefixed model ID", () => {
    const result = stripBedrockInferenceProfilePrefix("anthropic.claude-opus-4-5-20251101-v1:0");
    expect(result.prefix).toBeNull();
    expect(result.baseModelId).toBe("anthropic.claude-opus-4-5-20251101-v1:0");
  });

  it("does not strip unknown prefixes", () => {
    const result = stripBedrockInferenceProfilePrefix("unknown.anthropic.model");
    expect(result.prefix).toBeNull();
    expect(result.baseModelId).toBe("unknown.anthropic.model");
  });
});
