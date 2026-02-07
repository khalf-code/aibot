import type { loadConfig } from "../config/config.js";
import type { GatewayRequestHandler } from "./server-methods/types.js";
import { writeConfigFile } from "../config/config-file.js";
import { loadOpenClawPlugins } from "../plugins/loader.js";
import { updateNpmInstalledPlugins } from "../plugins/update.js";

export async function autoUpdatePluginsOnStartup(params: {
  cfg: ReturnType<typeof loadConfig>;
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}): Promise<ReturnType<typeof loadConfig>> {
  const autoUpdate = params.cfg.plugins?.autoUpdate ?? true;
  if (!autoUpdate) {
    return params.cfg;
  }

  const installs = params.cfg.plugins?.installs ?? {};
  const hasNpmPlugins = Object.values(installs).some((r) => r.source === "npm");
  if (!hasNpmPlugins) {
    return params.cfg;
  }

  params.log.info("[plugins] Checking for plugin updates...");

  const result = await updateNpmInstalledPlugins({
    config: params.cfg,
    logger: {
      info: (msg) => params.log.info(msg),
      warn: (msg) => params.log.warn(msg),
      error: (msg) => params.log.error(msg),
    },
  });

  for (const outcome of result.outcomes) {
    if (outcome.status === "updated") {
      params.log.info(`[plugins] ${outcome.message}`);
    } else if (outcome.status === "error") {
      params.log.warn(`[plugins] ${outcome.message}`);
    }
  }

  if (result.changed) {
    await writeConfigFile(result.config);
    params.log.info("[plugins] Plugin updates applied.");
  }

  return result.config;
}

export function loadGatewayPlugins(params: {
  cfg: ReturnType<typeof loadConfig>;
  workspaceDir: string;
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };
  coreGatewayHandlers: Record<string, GatewayRequestHandler>;
  baseMethods: string[];
}) {
  const pluginRegistry = loadOpenClawPlugins({
    config: params.cfg,
    workspaceDir: params.workspaceDir,
    logger: {
      info: (msg) => params.log.info(msg),
      warn: (msg) => params.log.warn(msg),
      error: (msg) => params.log.error(msg),
      debug: (msg) => params.log.debug(msg),
    },
    coreGatewayHandlers: params.coreGatewayHandlers,
  });
  const pluginMethods = Object.keys(pluginRegistry.gatewayHandlers);
  const gatewayMethods = Array.from(new Set([...params.baseMethods, ...pluginMethods]));
  if (pluginRegistry.diagnostics.length > 0) {
    for (const diag of pluginRegistry.diagnostics) {
      const details = [
        diag.pluginId ? `plugin=${diag.pluginId}` : null,
        diag.source ? `source=${diag.source}` : null,
      ]
        .filter((entry): entry is string => Boolean(entry))
        .join(", ");
      const message = details
        ? `[plugins] ${diag.message} (${details})`
        : `[plugins] ${diag.message}`;
      if (diag.level === "error") {
        params.log.error(message);
      } else {
        params.log.info(message);
      }
    }
  }
  return { pluginRegistry, gatewayMethods };
}
