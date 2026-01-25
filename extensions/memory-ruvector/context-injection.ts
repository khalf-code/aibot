/**
 * Context Injection for ruvLLM
 *
 * Enriches agent prompts with relevant memories from the vector store.
 * Supports automatic injection via the before_agent_start hook.
 */

import type { ClawdbotPluginApi, PluginHookAgentContext, PluginHookBeforeAgentStartEvent } from "clawdbot/plugin-sdk";

import type { RuvectorDB, SearchResult } from "./db.js";
import type { EmbeddingProvider } from "./embeddings.js";
import type { ContextInjectionConfig, InjectedContext } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for context injection.
 */
export type InjectContextOptions = {
  /** Maximum number of results to include */
  maxResults?: number;
  /** Minimum relevance score (0-1) */
  minScore?: number;
  /** Filter by channel */
  channel?: string;
  /** Filter by session key */
  sessionKey?: string;
  /** Include only inbound/outbound messages */
  direction?: "inbound" | "outbound";
};

/**
 * Logger interface for context injector.
 */
export type ContextInjectorLogger = {
  info?: (message: string) => void;
  warn: (message: string) => void;
  debug?: (message: string) => void;
};

/**
 * Dependencies for ContextInjector.
 */
export type ContextInjectorDeps = {
  db: RuvectorDB;
  embeddings: EmbeddingProvider;
  logger: ContextInjectorLogger;
};

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Rough token estimation (approximately 4 characters per token for English text).
 * This is a simple heuristic; for precise counting, use tiktoken or similar.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// ContextInjector Class
// =============================================================================

/**
 * Enriches agent prompts with relevant memories from the vector store.
 *
 * Features:
 * - Retrieves semantically similar memories for a query
 * - Formats memories for injection into prompts
 * - Respects token limits and relevance thresholds
 * - Supports filtering by channel, session, and direction
 *
 * Usage:
 * ```typescript
 * const injector = new ContextInjector(config, { db, embeddings, logger });
 *
 * // Inject context for a query
 * const result = await injector.injectContext("What did I say about preferences?");
 * console.log(result.contextText);
 *
 * // Use with hook
 * registerContextInjectionHook(api, injector, embeddings);
 * ```
 */
export class ContextInjector {
  private config: ContextInjectionConfig;
  private db: RuvectorDB;
  private embeddings: EmbeddingProvider;
  private logger: ContextInjectorLogger;

  constructor(config: ContextInjectionConfig, deps: ContextInjectorDeps) {
    this.config = config;
    this.db = deps.db;
    this.embeddings = deps.embeddings;
    this.logger = deps.logger;
  }

  /**
   * Check if context injection is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the configured maximum tokens for context.
   */
  getMaxTokens(): number {
    return this.config.maxTokens;
  }

  /**
   * Get the configured relevance threshold.
   */
  getRelevanceThreshold(): number {
    return this.config.relevanceThreshold;
  }

  /**
   * Inject relevant context for a query.
   *
   * @param query - The search query text
   * @param options - Optional filter and limit settings
   * @returns The injected context with metadata
   */
  async injectContext(
    query: string,
    options: InjectContextOptions = {},
  ): Promise<InjectedContext> {
    if (!this.config.enabled) {
      return {
        contextText: "",
        memoriesIncluded: 0,
        estimatedTokens: 0,
        memoryIds: [],
      };
    }

    const {
      maxResults = 10,
      minScore = this.config.relevanceThreshold,
      channel,
      sessionKey,
      direction,
    } = options;

    try {
      // Generate embedding for the query
      const queryVector = await this.embeddings.embed(query);

      // Search for relevant memories
      const results = await this.db.search(queryVector, {
        limit: maxResults,
        minScore,
        filter: {
          channel,
          sessionKey,
          direction,
        },
      });

      if (results.length === 0) {
        this.logger.debug?.("context-injection: no relevant memories found");
        return {
          contextText: "",
          memoriesIncluded: 0,
          estimatedTokens: 0,
          memoryIds: [],
        };
      }

      // Format results as context, respecting token limit
      const formatted = this.formatContext(results);

      this.logger.debug?.(
        `context-injection: injected ${formatted.memoriesIncluded} memories (${formatted.estimatedTokens} tokens)`,
      );

      return formatted;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`context-injection: failed to inject context: ${message}`);
      return {
        contextText: "",
        memoriesIncluded: 0,
        estimatedTokens: 0,
        memoryIds: [],
      };
    }
  }

  /**
   * Format search results as context text, respecting token limits.
   *
   * @param results - Search results to format
   * @returns Formatted context with metadata
   */
  formatContext(results: SearchResult[]): InjectedContext {
    const memoryIds: string[] = [];
    const formattedMemories: string[] = [];
    let totalTokens = 0;

    // Header tokens (approximately)
    const headerText = "<relevant-memories>\n";
    const footerText = "</relevant-memories>";
    const headerTokens = estimateTokens(headerText);
    const footerTokens = estimateTokens(footerText);
    const availableTokens = this.config.maxTokens - headerTokens - footerTokens;

    for (const result of results) {
      const { document, score } = result;

      // Format single memory entry
      const memoryText = this.formatMemory(document, score);
      const memoryTokens = estimateTokens(memoryText);

      // Check if adding this memory would exceed the limit
      if (totalTokens + memoryTokens > availableTokens) {
        break;
      }

      formattedMemories.push(memoryText);
      memoryIds.push(document.id);
      totalTokens += memoryTokens;
    }

    if (formattedMemories.length === 0) {
      return {
        contextText: "",
        memoriesIncluded: 0,
        estimatedTokens: 0,
        memoryIds: [],
      };
    }

    const contextText = `${headerText}${formattedMemories.join("\n")}\n${footerText}`;

    return {
      contextText,
      memoriesIncluded: formattedMemories.length,
      estimatedTokens: totalTokens + headerTokens + footerTokens,
      memoryIds,
    };
  }

  /**
   * Format a single memory document for injection.
   *
   * @param document - The memory document
   * @param score - The relevance score
   * @returns Formatted memory text
   */
  private formatMemory(
    document: SearchResult["document"],
    score: number,
  ): string {
    const timestamp = new Date(document.timestamp).toISOString();
    const direction = document.direction === "inbound" ? "User" : "Assistant";
    const relevance = Math.round(score * 100);

    // Truncate long content
    const maxContentLength = 500;
    const content = document.content.length > maxContentLength
      ? document.content.slice(0, maxContentLength) + "..."
      : document.content;

    return `[${timestamp}] (${direction}, ${relevance}% relevant) ${content}`;
  }

  /**
   * Build context for a specific user message.
   * Convenience method that extracts text content from the message event.
   *
   * @param message - The user message text
   * @param ctx - Hook context for filtering
   * @returns The injected context
   */
  async buildContextForMessage(
    message: string,
    ctx?: { channelId?: string; sessionKey?: string },
  ): Promise<InjectedContext> {
    return this.injectContext(message, {
      channel: ctx?.channelId,
      sessionKey: ctx?.sessionKey,
      // Only include past messages, not the current query
      direction: undefined,
    });
  }

  /**
   * Find related patterns based on similar trajectories.
   * Uses query similarity to find patterns from past successful searches.
   *
   * @param query - The search query
   * @param relatedQueries - Array of similar past queries
   * @returns Combined context from related patterns
   */
  async injectRelatedPatterns(
    query: string,
    relatedQueries: string[],
  ): Promise<InjectedContext> {
    if (!this.config.enabled || relatedQueries.length === 0) {
      return {
        contextText: "",
        memoriesIncluded: 0,
        estimatedTokens: 0,
        memoryIds: [],
      };
    }

    // Get context for the main query
    const mainContext = await this.injectContext(query);

    // If we have enough context, return it
    if (mainContext.estimatedTokens >= this.config.maxTokens * 0.8) {
      return mainContext;
    }

    // Try to augment with related query results
    const remainingTokens = this.config.maxTokens - mainContext.estimatedTokens;
    const relatedMemoryIds = new Set(mainContext.memoryIds);
    const additionalMemories: string[] = [];
    let additionalTokens = 0;

    for (const relatedQuery of relatedQueries.slice(0, 3)) {
      try {
        const relatedContext = await this.injectContext(relatedQuery, {
          maxResults: 3,
        });

        for (const memoryId of relatedContext.memoryIds) {
          if (relatedMemoryIds.has(memoryId)) continue;
          relatedMemoryIds.add(memoryId);
        }

        if (relatedContext.contextText && additionalTokens + relatedContext.estimatedTokens <= remainingTokens) {
          additionalMemories.push(`\n<!-- Related to: "${relatedQuery.slice(0, 50)}..." -->`);
          additionalTokens += relatedContext.estimatedTokens;
        }
      } catch {
        // Ignore errors from related queries
      }
    }

    // Return combined context
    if (additionalMemories.length === 0) {
      return mainContext;
    }

    return {
      contextText: mainContext.contextText,
      memoriesIncluded: relatedMemoryIds.size,
      estimatedTokens: mainContext.estimatedTokens + additionalTokens,
      memoryIds: Array.from(relatedMemoryIds),
    };
  }
}

// =============================================================================
// Hook Registration
// =============================================================================

/**
 * Register the before_agent_start hook for automatic context injection.
 *
 * @param api - Plugin API
 * @param injector - ContextInjector instance
 * @param embeddings - Embedding provider for query vectorization
 */
export function registerContextInjectionHook(
  api: ClawdbotPluginApi,
  injector: ContextInjector,
): void {
  if (!injector.isEnabled()) {
    api.logger.info?.("ruvllm: context injection disabled, skipping hook registration");
    return;
  }

  api.on(
    "before_agent_start",
    async (
      event: PluginHookBeforeAgentStartEvent,
      ctx: PluginHookAgentContext,
    ) => {
      try {
        // Extract the user message from the event
        const userMessage = extractUserMessage(event);
        if (!userMessage) {
          api.logger.debug?.("ruvllm: no user message found, skipping context injection");
          return;
        }

        // Build context for the user message
        const context = await injector.buildContextForMessage(userMessage, {
          channelId: ctx.messageProvider,
          sessionKey: ctx.sessionKey,
        });

        if (context.contextText && context.memoriesIncluded > 0) {
          // Inject context into the system prompt
          if (event.systemPrompt) {
            event.systemPrompt = `${event.systemPrompt}\n\n${context.contextText}`;
          } else {
            event.systemPrompt = context.contextText;
          }

          api.logger.debug?.(
            `ruvllm: injected ${context.memoriesIncluded} memories (${context.estimatedTokens} tokens) into agent prompt`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        api.logger.warn(`ruvllm: before_agent_start hook error: ${message}`);
      }
    },
    { priority: 50 }, // Medium-high priority, run before most other handlers
  );

  api.logger.info?.("ruvllm: registered before_agent_start hook for context injection");
}

/**
 * Extract user message text from the before_agent_start event.
 *
 * @param event - The hook event
 * @returns The user message text, or null if not found
 */
function extractUserMessage(event: PluginHookBeforeAgentStartEvent): string | null {
  // Check for messages array
  if (!event.messages || !Array.isArray(event.messages)) {
    return null;
  }

  // Find the last user message
  for (let i = event.messages.length - 1; i >= 0; i--) {
    const msg = event.messages[i];
    if (!msg || typeof msg !== "object") continue;

    const msgObj = msg as Record<string, unknown>;
    if (msgObj.role !== "user") continue;

    // Handle string content
    if (typeof msgObj.content === "string") {
      return msgObj.content;
    }

    // Handle array content (content blocks)
    if (Array.isArray(msgObj.content)) {
      for (const block of msgObj.content) {
        if (
          block &&
          typeof block === "object" &&
          "type" in block &&
          (block as Record<string, unknown>).type === "text" &&
          "text" in block &&
          typeof (block as Record<string, unknown>).text === "string"
        ) {
          return (block as Record<string, unknown>).text as string;
        }
      }
    }
  }

  return null;
}
