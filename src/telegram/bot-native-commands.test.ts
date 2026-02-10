import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { TelegramAccountConfig } from "../config/types.js";
import type { RuntimeEnv } from "../runtime.js";
import { registerTelegramNativeCommands } from "./bot-native-commands.js";

const { listSkillCommandsForAgents } = vi.hoisted(() => ({
  listSkillCommandsForAgents: vi.fn(() => []),
}));

vi.mock("../auto-reply/skill-commands.js", () => ({
  listSkillCommandsForAgents,
}));

type TelegramMenuCommand = { command: string; description: string };

describe("registerTelegramNativeCommands", () => {
  beforeEach(() => {
    listSkillCommandsForAgents.mockReset();
  });

  const buildParams = (cfg: OpenClawConfig, accountId = "default") => ({
    bot: {
      api: {
        setMyCommands: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
      command: vi.fn(),
    } as unknown as Parameters<typeof registerTelegramNativeCommands>[0]["bot"],
    cfg,
    runtime: {} as RuntimeEnv,
    accountId,
    telegramCfg: {} as TelegramAccountConfig,
    allowFrom: [],
    groupAllowFrom: [],
    replyToMode: "off" as const,
    textLimit: 4096,
    useAccessGroups: false,
    nativeEnabled: true,
    nativeSkillsEnabled: true,
    nativeDisabledExplicit: false,
    resolveGroupPolicy: () => ({ allowlistEnabled: false, allowed: true }),
    resolveTelegramGroupConfig: () => ({
      groupConfig: undefined,
      topicConfig: undefined,
    }),
    shouldSkipUpdate: () => false,
    opts: { token: "token" },
  });

  it("scopes skill commands when account binding exists", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [{ id: "main", default: true }, { id: "butler" }],
      },
      bindings: [
        {
          agentId: "butler",
          match: { channel: "telegram", accountId: "bot-a" },
        },
      ],
    };

    registerTelegramNativeCommands(buildParams(cfg, "bot-a"));

    expect(listSkillCommandsForAgents).toHaveBeenCalledWith({
      cfg,
      agentIds: ["butler"],
    });
  });

  it("keeps skill commands unscoped without a matching binding", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [{ id: "main", default: true }, { id: "butler" }],
      },
    };

    registerTelegramNativeCommands(buildParams(cfg, "bot-a"));

    expect(listSkillCommandsForAgents).toHaveBeenCalledWith({ cfg });
  });

  it("registers default and private command scopes with different command sets", () => {
    listSkillCommandsForAgents.mockReturnValue([
      {
        name: "skill_alert",
        skillName: "skill-alert",
        description: "Skill alert",
      },
    ]);

    const cfg: OpenClawConfig = {
      channels: {
        telegram: {
          customCommands: [{ command: "ops_help", description: "Ops helper" }],
        },
      },
    };
    const params = buildParams(cfg, "bot-a");
    params.telegramCfg = {
      customCommands: [{ command: "ops_help", description: "Ops helper" }],
    } as TelegramAccountConfig;

    registerTelegramNativeCommands(params);

    const setMyCommands = (
      params.bot as unknown as { api: { setMyCommands: ReturnType<typeof vi.fn> } }
    ).api.setMyCommands;

    expect(setMyCommands).toHaveBeenCalledTimes(2);

    const calls = setMyCommands.mock.calls as Array<
      [TelegramMenuCommand[], { scope?: { type?: string } } | undefined]
    >;
    const defaultScopeCall = calls.find(([, options]) => options?.scope?.type === "default");
    const privateScopeCall = calls.find(
      ([, options]) => options?.scope?.type === "all_private_chats",
    );

    expect(defaultScopeCall).toBeTruthy();
    expect(privateScopeCall).toBeTruthy();

    const defaultCommands = defaultScopeCall?.[0] ?? [];
    const privateCommands = privateScopeCall?.[0] ?? [];

    expect(defaultCommands).toContainEqual({ command: "ops_help", description: "Ops helper" });
    expect(defaultCommands.some((command) => command.command === "skill_alert")).toBe(false);

    expect(privateCommands).toContainEqual({ command: "ops_help", description: "Ops helper" });
    expect(privateCommands).toContainEqual({ command: "skill_alert", description: "Skill alert" });
  });

  it("caps private command scope at Telegram limit while keeping explicit commands", () => {
    listSkillCommandsForAgents.mockReturnValue(
      Array.from({ length: 120 }, (_, index) => ({
        name: `skill_${index + 1}`,
        skillName: `skill-${index + 1}`,
        description: `Skill ${index + 1}`,
      })),
    );

    const cfg: OpenClawConfig = {
      channels: {
        telegram: {
          customCommands: [{ command: "ops_help", description: "Ops helper" }],
        },
      },
    };
    const params = buildParams(cfg, "bot-a");
    params.telegramCfg = {
      customCommands: [{ command: "ops_help", description: "Ops helper" }],
    } as TelegramAccountConfig;

    registerTelegramNativeCommands(params);

    const setMyCommands = (
      params.bot as unknown as { api: { setMyCommands: ReturnType<typeof vi.fn> } }
    ).api.setMyCommands;
    const calls = setMyCommands.mock.calls as Array<
      [TelegramMenuCommand[], { scope?: { type?: string } } | undefined]
    >;
    const privateScopeCall = calls.find(
      ([, options]) => options?.scope?.type === "all_private_chats",
    );

    const registered = privateScopeCall?.[0] ?? [];

    expect(registered).toHaveLength(37);
    expect(registered).toContainEqual({ command: "ops_help", description: "Ops helper" });
  });

  it("clears commands for both scopes when deleteMyCommands is available", async () => {
    const cfg: OpenClawConfig = {};
    const params = buildParams(cfg, "bot-a");
    const deleteMyCommands = vi.fn().mockResolvedValue(undefined);
    (
      params.bot as unknown as {
        api: { deleteMyCommands?: ReturnType<typeof vi.fn> };
      }
    ).api.deleteMyCommands = deleteMyCommands;

    registerTelegramNativeCommands(params);
    await Promise.resolve();
    await Promise.resolve();

    expect(deleteMyCommands).toHaveBeenCalledTimes(2);
    expect(deleteMyCommands).toHaveBeenCalledWith({ scope: { type: "default" } });
    expect(deleteMyCommands).toHaveBeenCalledWith({
      scope: { type: "all_private_chats" },
    });
  });
});
