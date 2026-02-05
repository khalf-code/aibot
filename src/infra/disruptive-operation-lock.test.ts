import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  acquireDisruptiveOperationLease,
  guardDisruptiveOperation,
  listDisruptiveOperationLeases,
  releaseDisruptiveOperationLease,
} from "./disruptive-operation-lock.js";

function testEnv(stateDir: string, configPath: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLAWDBOT_STATE_DIR: stateDir,
    CLAWDBOT_CONFIG_PATH: configPath,
  };
}

describe("disruptive-operation lock", () => {
  it("persists leases, lists holders, and blocks operations unless forced", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "moltbot-disruptive-lock-"));
    const configPath = path.join(dir, "moltbot.json");
    await fs.writeFile(configPath, "{}", "utf8");

    const env = testEnv(dir, configPath);

    const lease = await acquireDisruptiveOperationLease({
      env,
      sessionKey: "agent:test:one",
      note: "maintenance",
      ttlSeconds: 60,
    });

    const list1 = await listDisruptiveOperationLeases(env);
    expect(list1.leases.map((l) => l.id)).toContain(lease.id);

    await expect(guardDisruptiveOperation({ env, operation: "update.run" })).rejects.toThrow(
      /Operation blocked/,
    );

    await expect(
      guardDisruptiveOperation({ env, operation: "update.run", force: true }),
    ).rejects.toThrow(/forceReason required/);

    const forced = await guardDisruptiveOperation({
      env,
      operation: "update.run",
      force: true,
      forceReason: "break glass",
    });
    expect(forced.ok).toBe(true);
    expect(forced.leases.length).toBe(1);

    // Ignore the invoker session key
    const ignored = await guardDisruptiveOperation({
      env,
      operation: "sessions.reset",
      subjectSessionKey: "agent:test:one",
    });
    expect(ignored.ok).toBe(true);

    const released = await releaseDisruptiveOperationLease({ env, id: lease.id });
    expect(released.released).toBe(true);

    const list2 = await listDisruptiveOperationLeases(env);
    expect(list2.leases.length).toBe(0);
  });

  it("always ignores agent:main:main as a blocking lease holder", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "moltbot-disruptive-lock-"));
    const configPath = path.join(dir, "moltbot.json");
    await fs.writeFile(configPath, "{}", "utf8");

    const env = testEnv(dir, configPath);

    await acquireDisruptiveOperationLease({
      env,
      sessionKey: "agent:main:main",
      note: "ui",
      ttlSeconds: 60,
    });

    // Should not block
    const ok = await guardDisruptiveOperation({ env, operation: "update.run" });
    expect(ok.ok).toBe(true);
  });
});
