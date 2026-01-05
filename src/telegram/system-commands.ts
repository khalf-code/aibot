export type TelegramSystemCommand = {
  id: string;
  names: string[];
  description: string;
};

export const TELEGRAM_SYSTEM_COMMANDS: TelegramSystemCommand[] = [
  {
    id: "model",
    names: ["model", "models"],
    description: "Select AI model",
  },
  {
    id: "think",
    names: ["think"],
    description: "Set thinking level",
  },
  {
    id: "status",
    names: ["status"],
    description: "Show bot status",
  },
  {
    id: "new",
    names: ["new", "reset"],
    description: "Reset chat session",
  },
  {
    id: "verbose",
    names: ["verbose"],
    description: "Set verbose mode",
  },
  {
    id: "elevated",
    names: ["elevated"],
    description: "Set elevated permissions",
  },
  {
    id: "id",
    names: ["id", "ids", "topicid"],
    description: "Show chat/topic IDs",
  },
  {
    id: "restart",
    names: ["restart"],
    description: "Restart gateway",
  },
  {
    id: "reauth",
    names: ["reauth"],
    description: "Re-authenticate OAuth",
  },
  {
    id: "retry",
    names: ["retry"],
    description: "Retry failed cron jobs",
  },
];

const SYSTEM_COMMANDS_BY_NAME = (() => {
  const map = new Map<string, TelegramSystemCommand>();
  for (const command of TELEGRAM_SYSTEM_COMMANDS) {
    for (const name of command.names) {
      const normalized = name.trim().toLowerCase();
      if (!normalized) continue;
      if (!map.has(normalized)) {
        map.set(normalized, command);
      }
    }
  }
  return map;
})();

export function resolveTelegramSystemCommand(
  name: string,
): TelegramSystemCommand | undefined {
  return SYSTEM_COMMANDS_BY_NAME.get(name.trim().toLowerCase());
}

export function listTelegramSystemCommandsForRegistration(): Array<{
  command: string;
  description: string;
}> {
  const result: Array<{ command: string; description: string }> = [];
  const seen = new Set<string>();
  for (const command of TELEGRAM_SYSTEM_COMMANDS) {
    for (const name of command.names) {
      const normalized = name.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push({ command: normalized, description: command.description });
    }
  }
  return result;
}
