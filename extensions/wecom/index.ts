/**
 * OpenClaw WeCom (WeChat Work) Channel Plugin
 * 企业微信渠道插件入口
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { wecomPlugin } from "./src/channel.js";
import { handleWecomWebhookRequest } from "./src/monitor.js";
import { setWecomRuntime } from "./src/runtime.js";

interface ExtendedPluginApi extends OpenClawPluginApi {
  registerHttpHandler?: (
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean> | boolean,
  ) => void;
}

const plugin = {
  id: "wecom",
  name: "WeCom",
  description: "企业微信智能机器人回调插件",
  configSchema: emptyPluginConfigSchema(),

  register(api: ExtendedPluginApi) {
    if (api.runtime) {
      setWecomRuntime(api.runtime as Record<string, unknown>);
    }
    api.registerChannel({ plugin: wecomPlugin });

    if (api.registerHttpHandler) {
      api.registerHttpHandler(handleWecomWebhookRequest);
    }
  },
};

export default plugin;

export { wecomPlugin } from "./src/channel.js";
export { setWecomRuntime, getWecomRuntime } from "./src/runtime.js";
export type { WecomConfig, ResolvedWecomAccount, WecomInboundMessage } from "./src/types.js";
