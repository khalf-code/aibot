import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { wpsPlugin } from "./src/channel.js";
import { setWpsRuntime } from "./src/runtime.js";

const plugin = {
  id: "wps",
  name: "wps",
  description: "wps channel plugin (Open Platform)",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setWpsRuntime(api.runtime);
    api.registerChannel({ plugin: wpsPlugin });
  },
};

export default plugin;