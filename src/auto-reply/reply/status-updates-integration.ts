/**
 * Status Updates Integration
 *
 * Integrates the status update controller with the agent runner
 * and provides helpers for resolving configuration from the config.
 */

import type { ClawdbotConfig } from "../../config/config.js";
import type { StatusUpdateConfig } from "../../config/types.base.js";
import type { ChannelCapabilities } from "../../channels/plugins/types.core.js";
import {
  createStatusUpdateController,
  type StatusPhase,
  type StatusUpdateCallbacks,
  type StatusUpdateController,
} from "./status-updates.js";

/**
 * Resolve status update configuration from the Clawdbot config.
 */
export function resolveStatusUpdateConfigFromConfig(
  cfg: ClawdbotConfig,
  agentId?: string,
): StatusUpdateConfig {
  // Check agent-specific config first
  if (agentId && cfg.agents?.list) {
    const agentCfg = cfg.agents.list.find((a) => a.id === agentId);
    if (agentCfg?.statusUpdates) {
      return agentCfg.statusUpdates;
    }
  }

  // Fall back to agent defaults
  return cfg.agents?.defaults?.statusUpdates ?? {};
}

/**
 * Check if a channel supports message editing.
 */
export function channelSupportsEdit(capabilities?: ChannelCapabilities): boolean {
  return capabilities?.edit === true;
}

/**
 * Create a status update controller for an agent run.
 * Returns undefined if status updates are disabled.
 */
export function createAgentStatusController(params: {
  cfg: ClawdbotConfig;
  agentId?: string;
  callbacks: StatusUpdateCallbacks;
}): StatusUpdateController | undefined {
  const { cfg, agentId, callbacks } = params;
  const config = resolveStatusUpdateConfigFromConfig(cfg, agentId);

  if (!config.enabled) {
    return undefined;
  }

  return createStatusUpdateController(config, callbacks);
}

/**
 * Map agent lifecycle events to status phases.
 */
export function mapAgentEventToPhase(
  event: { stream: string; data: Record<string, unknown> },
): StatusPhase | undefined {
  const { stream, data } = event;
  const phase = typeof data.phase === "string" ? data.phase : "";

  if (stream === "lifecycle") {
    if (phase === "start") return "sending_query";
    if (phase === "end") return "complete";
  }

  if (stream === "tool") {
    if (phase === "start") return "processing_tools";
  }

  if (stream === "thinking" || stream === "reasoning") {
    return "receiving_reasoning";
  }

  if (stream === "message") {
    if (phase === "start") return "generating_response";
  }

  return undefined;
}

/**
 * Context for status updates within an agent run.
 */
export type StatusUpdateRunContext = {
  controller?: StatusUpdateController;
  startedAt: number;
  currentPhase: StatusPhase;
};

/**
 * Create a run context for status updates.
 */
export function createStatusUpdateRunContext(
  controller?: StatusUpdateController,
): StatusUpdateRunContext {
  return {
    controller,
    startedAt: Date.now(),
    currentPhase: "sending_query",
  };
}

/**
 * Handle an agent event and update the status phase if applicable.
 */
export async function handleAgentEventForStatus(
  ctx: StatusUpdateRunContext,
  event: { stream: string; data: Record<string, unknown> },
): Promise<void> {
  if (!ctx.controller) return;

  const phase = mapAgentEventToPhase(event);
  if (phase && phase !== ctx.currentPhase) {
    ctx.currentPhase = phase;
    await ctx.controller.setPhase(phase);
  }
}

/**
 * Mark the status as complete and optionally add checkmark to final text.
 */
export async function completeStatusUpdate(
  ctx: StatusUpdateRunContext,
  finalText?: string,
): Promise<string | undefined> {
  if (!ctx.controller) return finalText;
  return ctx.controller.complete(finalText);
}

/**
 * Cleanup the status update controller.
 */
export async function cleanupStatusUpdate(ctx: StatusUpdateRunContext): Promise<void> {
  if (!ctx.controller) return;
  await ctx.controller.cleanup();
}

/**
 * Export a no-op callbacks object for channels that don't support status updates.
 */
export const noopStatusCallbacks: StatusUpdateCallbacks = {
  sendStatus: async () => undefined,
  supportsEdit: () => false,
};
