# End-to-End Testing Guide

> **Purpose**: Patterns for writing E2E tests in clawdbot.
> This repo is synced with upstream - explore locally, this doc provides patterns.

## Explore First

Before starting, check current state locally (synced from upstream):

| Concern | Where to look |
|---------|---------------|
| E2E config | `vitest.e2e.config.ts` |
| E2E test examples | `test/**/*.e2e.test.ts` |
| Test isolation setup | `test/setup.ts` |
| Gateway test helpers | `src/gateway/test-helpers.ts` |
| Live test examples | `src/**/*.live.test.ts` |

---

## Configuration

| File | Purpose |
|------|---------|
| `vitest.e2e.config.ts` | E2E test config, includes `test/**/*.e2e.test.ts` |
| `test/setup.ts` | Global setup (temp HOME isolation) |
| `test/gateway.multi.e2e.test.ts` | Main E2E test (476 lines) |

### Run E2E Tests

```bash
pnpm test:e2e
```

### E2E vs Unit Tests

| Aspect | Unit Tests | E2E Tests |
|--------|-----------|-----------|
| Location | `src/**/*.test.ts` | `test/**/*.e2e.test.ts` |
| Config | `vitest.config.ts` | `vitest.e2e.config.ts` |
| Isolation | Mocked dependencies | Real processes |
| Speed | Fast (ms) | Slow (seconds) |
| Timeout | Default 10s | Extended 120s |

---

## E2E Patterns (from `test/gateway.multi.e2e.test.ts`)

### Pattern 1: Ephemeral Port Allocation

```typescript
// From lines 41-51
const getFreePort = async () => {
  const srv = net.createServer();
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const addr = srv.address();
  if (!addr || typeof addr === "string") {
    srv.close();
    throw new Error("failed to bind ephemeral port");
  }
  await new Promise<void>((resolve) => srv.close(() => resolve()));
  return addr.port;
};
```

### Pattern 2: Port Readiness Polling

```typescript
// From lines 53-96
const waitForPortOpen = async (
  proc: ChildProcessWithoutNullStreams,
  port: number,
  timeoutMs: number,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // Check if process exited early
    if (proc.exitCode !== null) {
      throw new Error(`process exited before listening`);
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect({ host: "127.0.0.1", port });
        socket.once("connect", () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", reject);
      });
      return; // Port is open
    } catch {
      await sleep(25); // Keep polling
    }
  }
  throw new Error(`timeout waiting for port ${port}`);
};
```

### Pattern 3: Process Spawning with Isolation

```typescript
// From lines 98-186
const spawnGatewayInstance = async (name: string): Promise<GatewayInstance> => {
  const port = await getFreePort();
  const bridgePort = await getFreePort();

  // Create isolated HOME directory
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `clawdbot-e2e-${name}-`),
  );

  // Create config in isolated HOME
  const configDir = path.join(homeDir, ".clawdbot");
  await fs.mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, "clawdbot.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  // Spawn with isolated environment
  const child = spawn(
    "bun",
    ["src/index.ts", "gateway", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        CLAWDBOT_CONFIG_PATH: configPath,
        CLAWDBOT_SKIP_PROVIDERS: "1",
        CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  // Capture stdout/stderr for debugging
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (d) => stdout.push(String(d)));
  child.stderr?.on("data", (d) => stderr.push(String(d)));

  await waitForPortOpen(child, port, GATEWAY_START_TIMEOUT_MS);

  return { name, port, homeDir, child, stdout, stderr };
};
```

### Pattern 4: Graceful Cleanup

```typescript
// From lines 188-211
const stopGatewayInstance = async (inst: GatewayInstance) => {
  // Try SIGTERM first
  if (inst.child.exitCode === null && !inst.child.killed) {
    inst.child.kill("SIGTERM");
  }

  // Wait for graceful exit
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => {
      if (inst.child.exitCode !== null) return resolve(true);
      inst.child.once("exit", () => resolve(true));
    }),
    sleep(5_000).then(() => false),
  ]);

  // Force kill if needed
  if (!exited && inst.child.exitCode === null) {
    inst.child.kill("SIGKILL");
  }

  // Clean up temp directory
  await fs.rm(inst.homeDir, { recursive: true, force: true });
};

// Register cleanup in afterAll
describe("e2e tests", () => {
  const instances: GatewayInstance[] = [];

  afterAll(async () => {
    for (const inst of instances) {
      await stopGatewayInstance(inst);
    }
  });
});
```

### Pattern 5: CLI JSON Output Testing

```typescript
// From lines 213-249
const runCliJson = async (
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<unknown> => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const child = spawn("bun", ["src/index.ts", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (d) => stdout.push(String(d)));
  child.stderr?.on("data", (d) => stderr.push(String(d)));

  const result = await new Promise((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );

  if (result.code !== 0) {
    throw new Error(`cli failed: ${stderr.join("")}`);
  }

  return JSON.parse(stdout.join("").trim());
};

// Usage
const health = await runCliJson(
  ["health", "--json", "--timeout", "10000"],
  { CLAWDBOT_GATEWAY_PORT: String(port) }
);
expect(health.ok).toBe(true);
```

### Pattern 6: HTTP Endpoint Testing

```typescript
// From lines 251-291
const postJson = async (url: string, body: unknown) => {
  const payload = JSON.stringify(body);
  const parsed = new URL(url);

  return await new Promise<{ status: number; json: unknown }>(
    (resolve, reject) => {
      const req = httpRequest(
        {
          method: "POST",
          hostname: parsed.hostname,
          port: Number(parsed.port),
          path: parsed.pathname,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => { data += chunk; });
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 0,
              json: data.trim() ? JSON.parse(data) : null,
            });
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    },
  );
};

// Usage
const hookRes = await postJson(
  `http://127.0.0.1:${port}/hooks/wake?token=${token}`,
  { text: "wake", mode: "now" }
);
expect(hookRes.status).toBe(200);
```

---

## E2E Test Template

Use this template for new E2E tests:

```typescript
// test/my-feature.e2e.test.ts
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const E2E_TIMEOUT_MS = 120_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Copy getFreePort, waitForPortOpen from gateway.multi.e2e.test.ts

type TestInstance = {
  name: string;
  port: number;
  homeDir: string;
  child: ChildProcessWithoutNullStreams;
};

const spawnInstance = async (name: string): Promise<TestInstance> => {
  const port = await getFreePort();
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), `e2e-${name}-`));

  // Setup config...

  const child = spawn("bun", ["src/index.ts", "gateway", "--port", String(port)], {
    env: { ...process.env, HOME: homeDir },
  });

  await waitForPortOpen(port, 30_000);
  return { name, port, homeDir, child };
};

const stopInstance = async (inst: TestInstance) => {
  inst.child.kill("SIGTERM");
  await fs.rm(inst.homeDir, { recursive: true, force: true });
};

describe("my feature e2e", () => {
  const instances: TestInstance[] = [];

  afterAll(async () => {
    for (const inst of instances) {
      await stopInstance(inst);
    }
  });

  it("does the expected thing", { timeout: E2E_TIMEOUT_MS }, async () => {
    const inst = await spawnInstance("test");
    instances.push(inst);

    // Test assertions...

    expect(true).toBe(true);
  });
});
```

---

## Recommended E2E Tests to Add

| Test File | Purpose | Priority |
|-----------|---------|----------|
| `test/cli.e2e.test.ts` | Test CLI commands end-to-end | High |
| `test/provider.e2e.test.ts` | Test provider message flows | Medium |
| `test/webhook.e2e.test.ts` | Test webhook endpoints | Medium |
| `test/recovery.e2e.test.ts` | Test reconnection/errors | Low |

---

## Environment Variables for E2E

From `test/gateway.multi.e2e.test.ts:131-146`:

| Variable | Purpose |
|----------|---------|
| `HOME` | Isolated home directory |
| `CLAWDBOT_CONFIG_PATH` | Config file location |
| `CLAWDBOT_STATE_DIR` | State directory |
| `CLAWDBOT_GATEWAY_TOKEN` | Auth token (empty for no auth) |
| `CLAWDBOT_SKIP_PROVIDERS` | Skip provider initialization |
| `CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER` | Skip browser server |
| `CLAWDBOT_SKIP_CANVAS_HOST` | Skip canvas host |
| `CLAWDBOT_ENABLE_BRIDGE_IN_TESTS` | Enable bridge for testing |

---

## Debugging E2E Tests

### Capture Output

```typescript
const stdout: string[] = [];
const stderr: string[] = [];
child.stdout?.on("data", (d) => stdout.push(String(d)));
child.stderr?.on("data", (d) => stderr.push(String(d)));

// On failure, log captured output
console.log("stdout:", stdout.join(""));
console.log("stderr:", stderr.join(""));
```

### Increase Timeout

```typescript
it("slow test", { timeout: 300_000 }, async () => {
  // 5 minute timeout
});
```

### Keep Instance Running

Comment out cleanup in `afterAll` to inspect state:

```typescript
afterAll(async () => {
  // Temporarily disabled for debugging
  // for (const inst of instances) {
  //   await stopInstance(inst);
  // }
  console.log("Instances still running:", instances.map(i => i.port));
});
```
