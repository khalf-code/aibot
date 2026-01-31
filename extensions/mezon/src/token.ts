import { readFileSync, existsSync } from "node:fs";

import type { MezonConfig, MezonTokenSource } from "./types.js";

export type MezonTokenResolution = {
  token: string;
  botId: string;
  source: MezonTokenSource;
};

/**
 * Resolve Mezon bot credentials from config, file, or environment.
 * Priority: config > configFile > env (env only for default account)
 */
export function resolveMezonToken(
  mezonConfig: MezonConfig | undefined,
  accountId: string,
): MezonTokenResolution {
  const isDefaultAccount = accountId === "default";
  const accountConfig = isDefaultAccount ? mezonConfig : mezonConfig?.accounts?.[accountId];
  const baseConfig = mezonConfig ?? {};

  // 1. Check direct config (botId + botToken)
  const configToken = accountConfig?.botToken ?? baseConfig.botToken;
  const configBotId = accountConfig?.botId ?? baseConfig.botId;
  if (configToken?.trim() && configBotId?.trim()) {
    return { token: configToken.trim(), botId: configBotId.trim(), source: "config" };
  }

  // 2. Check token file (format: "botId:token" or just "token")
  const tokenFile = accountConfig?.tokenFile ?? baseConfig.tokenFile;
  if (tokenFile?.trim() && existsSync(tokenFile)) {
    const fileContent = readFileSync(tokenFile, "utf8").trim();
    if (fileContent.includes(":")) {
      const [fileBotId, fileToken] = fileContent.split(":", 2);
      if (fileBotId?.trim() && fileToken?.trim()) {
        return { token: fileToken.trim(), botId: fileBotId.trim(), source: "configFile" };
      }
    }
    // File contains only token, need botId from elsewhere
    const fileBotId = configBotId ?? process.env.MEZON_BOT_ID;
    if (fileContent && fileBotId?.trim()) {
      return { token: fileContent, botId: fileBotId.trim(), source: "configFile" };
    }
  }

  // 3. Check environment variables (default account only)
  if (isDefaultAccount) {
    const envToken = process.env.MEZON_BOT_TOKEN?.trim();
    const envBotId = process.env.MEZON_BOT_ID?.trim() ?? configBotId?.trim();
    if (envToken && envBotId) {
      return { token: envToken, botId: envBotId, source: "env" };
    }
  }

  return { token: "", botId: configBotId?.trim() ?? "", source: "none" };
}
