import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { claudeMemConfigSchema } from "./config.js";
import { ClaudeMemClient } from "./client.js";

const claudeMemPlugin = {
  id: "memory-claudemem",
  name: "Memory (Claude-Mem)",
  description: "Real-time observation and memory via claude-mem worker",
  kind: "memory" as const,
  configSchema: claudeMemConfigSchema,

  register(api: ClawdbotPluginApi) {
    const cfg = claudeMemConfigSchema.parse(api.pluginConfig);
    const client = new ClaudeMemClient(cfg.workerUrl, cfg.workerTimeout);

    api.logger.info(
      `memory-claudemem: plugin registered (worker: ${cfg.workerUrl})`,
    );

    // Hook: after_tool_call → Observe tool calls (fire-and-forget)
    api.on("after_tool_call", async (event, ctx) => {
      // Skip memory tools to prevent recursion
      if (event.toolName.startsWith("memory_")) return;

      try {
        // Fire-and-forget: don't await, let it run in parallel
        // Use sessionKey as the session identifier (may be undefined)
        client.observe(
          ctx.sessionKey ?? "unknown",
          event.toolName,
          event.params,
          event.result,
        );
      } catch (err) {
        api.logger.warn?.(`memory-claudemem: observation failed: ${err}`);
      }
    });

    // Hook: before_agent_start → Context injection from memory search
    api.on("before_agent_start", async (event) => {
      // Skip if prompt is empty or too short
      if (!event.prompt || event.prompt.length < 5) return;

      try {
        const results = await client.search(event.prompt, 5);
        if (results.length === 0) return;

        const memoryContext = results
          .map((r) => `- [#${r.id}] ${r.title}: ${r.snippet}`)
          .join("\n");

        api.logger.info?.(
          `memory-claudemem: injecting ${results.length} memories into context`,
        );

        return {
          prependContext: `<claude-mem-context>\nThe following memories may be relevant:\n${memoryContext}\n</claude-mem-context>`,
        };
      } catch (err) {
        api.logger.warn?.(`memory-claudemem: context injection failed: ${err}`);
      }
    });

    // TODO: Phase 5 - Tool registration
    // TODO: Phase 6 - CLI registration
  },
};

export default claudeMemPlugin;
