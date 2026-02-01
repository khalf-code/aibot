import type { ZoidbergBotPluginApi } from "../../src/plugins/types.js";
import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: ZoidbergBotPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
