import { completeSimple, type TextContent } from "@mariozechner/pi-ai";

import { getApiKeyForModel, requireApiKey } from "../../agents/model-auth.js";
import { parseModelRef } from "../../agents/model-selection.js";
import { resolveModel } from "../../agents/pi-embedded-runner/model.js";
import type { OpenClawConfig } from "../../config/config.js";
import { logVerbose } from "../../globals.js";

export type RelevanceModelRef = {
  provider: string;
  model: string;
};

const FAST_MODEL_MAP: Record<string, { provider: string; model: string }> = {
  anthropic: { provider: "anthropic", model: "claude-3-haiku-20240307" },
  openai: { provider: "openai", model: "gpt-4o-mini" },
  google: { provider: "google", model: "gemini-2.0-flash" },
};

/**
 * Resolves which model to use for relevance checking.
 * @param relevanceModelConfig - "auto" for provider-matched fast model, or explicit "provider/model"
 */
export function resolveRelevanceModel(params: {
  relevanceModelConfig: string;
  mainProvider: string;
  mainModel: string;
}): RelevanceModelRef {
  if (params.relevanceModelConfig !== "auto") {
    const parsed = parseModelRef(params.relevanceModelConfig, params.mainProvider);
    if (parsed) {
      return parsed;
    }
  }

  const providerKey = params.mainProvider.toLowerCase();
  const mapped = FAST_MODEL_MAP[providerKey];
  if (mapped) {
    return mapped;
  }

  return { provider: params.mainProvider, model: params.mainModel };
}

const RELEVANCE_PROMPT = `You are evaluating whether a message in a team chat requires a response from an AI assistant.

Context about the channel: {channelContext}
The assistant's role: {agentPersona}

Evaluate this message and decide if the assistant should respond. Consider:
- Is the message a question or request that the assistant could help with?
- Is the assistant being addressed directly or indirectly?
- Would a helpful team member naturally chime in here?
- Is this relevant to the assistant's expertise/role?

Do NOT respond to:
- General social chat ("lol", "nice", "thanks everyone")
- Messages clearly directed at specific humans
- Off-topic discussions unrelated to the assistant's role
- Simple acknowledgments or reactions

Message to evaluate:
{message}

Reply with exactly one line:
RESPOND: <brief reason why assistant should respond>
or
SKIP: <brief reason why assistant should stay silent>`;

export type RelevanceCheckResult = {
  shouldRespond: boolean;
  reason: string;
};

export type RelevanceRunner = (prompt: string) => Promise<{ text: string }>;

function isTextContentBlock(block: { type: string }): block is TextContent {
  return block.type === "text";
}

const DEFAULT_RELEVANCE_TIMEOUT_MS = 10_000;
const DEFAULT_RELEVANCE_MAX_TOKENS = 100;

/**
 * Creates a RelevanceRunner that uses completeSimple to call the model.
 * This is the actual implementation for relevance checking.
 */
export async function createRelevanceRunner(params: {
  modelRef: RelevanceModelRef;
  cfg: OpenClawConfig;
  timeoutMs?: number;
}): Promise<RelevanceRunner> {
  const { modelRef, cfg, timeoutMs = DEFAULT_RELEVANCE_TIMEOUT_MS } = params;

  const resolved = resolveModel(modelRef.provider, modelRef.model, undefined, cfg);
  if (!resolved.model) {
    logVerbose(`relevance-check: model not found ${modelRef.provider}/${modelRef.model}`);
    // Return a fail-open runner
    return async () => ({ text: "RESPOND: Model not available, defaulting to respond" });
  }

  let apiKey: string;
  try {
    const auth = await getApiKeyForModel({ model: resolved.model, cfg });
    apiKey = requireApiKey(auth, modelRef.provider);
  } catch (err) {
    logVerbose(`relevance-check: API key error for ${modelRef.provider}: ${String(err)}`);
    // Return a fail-open runner
    return async () => ({ text: "RESPOND: API key not available, defaulting to respond" });
  }

  const model = resolved.model;

  return async (prompt: string): Promise<{ text: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await completeSimple(
        model,
        {
          messages: [
            {
              role: "user",
              content: prompt,
              timestamp: Date.now(),
            },
          ],
        },
        {
          apiKey,
          maxTokens: DEFAULT_RELEVANCE_MAX_TOKENS,
          temperature: 0.1,
          signal: controller.signal,
        },
      );

      const text = res.content
        .filter(isTextContentBlock)
        .map((block) => block.text.trim())
        .filter(Boolean)
        .join(" ")
        .trim();

      return { text: text || "SKIP: No response from model" };
    } catch (err) {
      const error = err as Error;
      if (error.name === "AbortError") {
        logVerbose("relevance-check: request timed out");
        return { text: "RESPOND: Timed out, defaulting to respond" };
      }
      logVerbose(`relevance-check: model call failed: ${String(err)}`);
      return { text: "RESPOND: Error during check, defaulting to respond" };
    } finally {
      clearTimeout(timeout);
    }
  };
}

export async function checkMessageRelevance(params: {
  message: string;
  channelContext: string;
  agentPersona: string;
  runner: RelevanceRunner;
}): Promise<RelevanceCheckResult> {
  const prompt = RELEVANCE_PROMPT.replace("{channelContext}", params.channelContext)
    .replace("{agentPersona}", params.agentPersona)
    .replace("{message}", params.message);

  try {
    const result = await params.runner(prompt);
    const text = result.text.trim();

    if (text.toUpperCase().startsWith("RESPOND:")) {
      return {
        shouldRespond: true,
        reason: text.slice(8).trim(),
      };
    }

    if (text.toUpperCase().startsWith("SKIP:")) {
      return {
        shouldRespond: false,
        reason: text.slice(5).trim(),
      };
    }

    return {
      shouldRespond: false,
      reason: "Unclear relevance signal, defaulting to silent",
    };
  } catch (err) {
    return {
      shouldRespond: true,
      reason: `Relevance check failed: ${String(err)}`,
    };
  }
}
