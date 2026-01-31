import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { mezonDock, mezonPlugin } from "./src/channel.js";
import { setMezonRuntime } from "./src/runtime.js";

const plugin = {
  id: "mezon",
  name: "Mezon",
  description: "Mezon - modern team communication platform",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setMezonRuntime(api.runtime);
    api.registerChannel({ plugin: mezonPlugin, dock: mezonDock });
  },
};

export default plugin;
