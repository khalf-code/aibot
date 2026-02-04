/**
 * OpenClaw QQ Channel Plugin (NapCatQQ/OneBot v11)
 * QQ 第三方协议插件入口
 *
 * This plugin provides QQ messaging support via NapCatQQ/OneBot v11 protocol.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { qqPlugin } from "./src/channel.js";
import { setQQRuntime } from "./src/runtime.js";

const plugin = {
  id: "qq",
  name: "QQ",
  description: "QQ channel plugin (via NapCatQQ/OneBot v11)",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi): void {
    // Inject runtime for access to logging, config, etc.
    setQQRuntime(api.runtime);

    // Register the channel plugin
    api.registerChannel({ plugin: qqPlugin });
  },
};

export default plugin;

export { qqPlugin } from "./src/channel.js";
export { setQQRuntime, getQQRuntime } from "./src/runtime.js";
