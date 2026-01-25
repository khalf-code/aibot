import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("commands-restore", () => {
  let tempDir: string;
  let configPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "clawdbot-restore-test-"));
    configPath = path.join(tempDir, "clawdbot.json");
    originalEnv = { ...process.env };
    process.env.CLAWDBOT_CONFIG_PATH = configPath;
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("lists available backups", async () => {
    // Create a valid config
    const validConfig = { agents: { list: [] } };
    await fs.promises.writeFile(configPath, JSON.stringify(validConfig));

    // Create some backups
    await fs.promises.writeFile(
      `${configPath}.bak`,
      JSON.stringify({ agents: { list: [{ id: "backup0" }] } }),
    );
    await fs.promises.writeFile(
      `${configPath}.bak.1`,
      JSON.stringify({ agents: { list: [{ id: "backup1" }] } }),
    );

    const { handleRestartFromBackupCommand } = await import("./commands-restore.js");

    const mockParams = {
      command: {
        commandBodyNormalized: "/restart-from-backup",
        isAuthorizedSender: true,
        senderId: "test",
      },
      cfg: { commands: { restart: true } },
      ctx: {},
    } as any;

    const result = await handleRestartFromBackupCommand(mockParams, true);

    expect(result).not.toBeNull();
    expect(result?.reply?.text).toContain("Available config backups");
    expect(result?.reply?.text).toContain("0:");
    expect(result?.reply?.text).toContain("1:");
  });

  it("rejects unauthorized senders", async () => {
    const { handleRestartFromBackupCommand } = await import("./commands-restore.js");

    const mockParams = {
      command: {
        commandBodyNormalized: "/restart-from-backup",
        isAuthorizedSender: false,
        senderId: "test",
      },
      cfg: { commands: { restart: true } },
      ctx: {},
    } as any;

    const result = await handleRestartFromBackupCommand(mockParams, true);

    expect(result).toEqual({ shouldContinue: false });
  });

  it("rejects when restart permission is disabled", async () => {
    const { handleRestartFromBackupCommand } = await import("./commands-restore.js");

    const mockParams = {
      command: {
        commandBodyNormalized: "/restart-from-backup",
        isAuthorizedSender: true,
        senderId: "test",
      },
      cfg: { commands: { restart: false } },
      ctx: {},
    } as any;

    const result = await handleRestartFromBackupCommand(mockParams, true);

    expect(result?.reply?.text).toContain("requires restart permission");
  });

  it("validates backup index range", async () => {
    const { handleRestartFromBackupCommand } = await import("./commands-restore.js");

    const mockParams = {
      command: {
        commandBodyNormalized: "/restart-from-backup 10",
        isAuthorizedSender: true,
        senderId: "test",
      },
      cfg: { commands: { restart: true } },
      ctx: {},
    } as any;

    const result = await handleRestartFromBackupCommand(mockParams, true);

    expect(result?.reply?.text).toContain("Invalid backup index");
  });

  it("reports missing backup", async () => {
    const { handleRestartFromBackupCommand } = await import("./commands-restore.js");

    const mockParams = {
      command: {
        commandBodyNormalized: "/restart-from-backup 0",
        isAuthorizedSender: true,
        senderId: "test",
      },
      cfg: { commands: { restart: true } },
      ctx: {},
    } as any;

    const result = await handleRestartFromBackupCommand(mockParams, true);

    expect(result?.reply?.text).toContain("not found");
  });
});
