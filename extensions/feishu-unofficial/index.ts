/**
 * OpenClaw Feishu/Lark Channel Plugin
 * 飞书渠道插件入口
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";

const plugin = {
  id: "feishu",
  name: "Feishu",
  description: "飞书/Lark 消息渠道插件",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    if (api.runtime) {
      setFeishuRuntime(api.runtime as Record<string, unknown>);
    }
    api.registerChannel({ plugin: feishuPlugin });
  },
};

export default plugin;

export { feishuPlugin } from "./src/channel.js";
export { setFeishuRuntime, getFeishuRuntime } from "./src/runtime.js";
export type { FeishuConfig, ResolvedFeishuAccount, FeishuSendResult } from "./src/types.js";
