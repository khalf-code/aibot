/**
 * OpenClaw DingTalk Channel Plugin
 * 钉钉渠道插件入口
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { dingtalkPlugin } from "./src/channel.js";
import { setDingTalkRuntime } from "./src/runtime.js";

const plugin = {
  id: "dingtalk",
  name: "DingTalk",
  description: "钉钉消息渠道插件",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    if (api.runtime) {
      setDingTalkRuntime(api.runtime as Record<string, unknown>);
    }
    api.registerChannel({ plugin: dingtalkPlugin });
  },
};

export default plugin;

export { dingtalkPlugin } from "./src/channel.js";
export { setDingTalkRuntime, getDingTalkRuntime } from "./src/runtime.js";
