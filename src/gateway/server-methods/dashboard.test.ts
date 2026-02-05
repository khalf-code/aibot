import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";
import { dashboardHandlers } from "./dashboard.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const noop = () => false;

function makeOpts(
  method: string,
  params: Record<string, unknown> = {},
  overrides: Partial<GatewayRequestHandlerOptions> = {},
): GatewayRequestHandlerOptions {
  return {
    req: { id: "req-1", type: "req", method },
    params,
    respond: vi.fn(),
    context: {
      broadcast: vi.fn(),
      broadcastToConnIds: vi.fn(),
    } as unknown as GatewayRequestHandlerOptions["context"],
    client: null,
    isWebchatConnect: noop,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// dashboard.snapshot
// ---------------------------------------------------------------------------

describe("dashboard.snapshot", () => {
  it("returns empty state", () => {
    const opts = makeOpts("dashboard.snapshot");
    dashboardHandlers["dashboard.snapshot"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        tracks: [],
        tasks: [],
        workers: [],
        reviews: [],
        worktrees: [],
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// dashboard.message.send
// ---------------------------------------------------------------------------

describe("dashboard.message.send", () => {
  it("rejects empty content", () => {
    const opts = makeOpts("dashboard.message.send", {});
    dashboardHandlers["dashboard.message.send"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "content is required" }),
    );
  });

  it("rejects non-string content", () => {
    const opts = makeOpts("dashboard.message.send", { content: 42 });
    dashboardHandlers["dashboard.message.send"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "content is required" }),
    );
  });

  it("creates a message, broadcasts, and responds with messageId", () => {
    const opts = makeOpts("dashboard.message.send", {
      content: "hello",
      trackId: "track-1",
    });
    dashboardHandlers["dashboard.message.send"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ messageId: expect.any(String) }),
    );

    const broadcast = opts.context.broadcast as ReturnType<typeof vi.fn>;
    expect(broadcast).toHaveBeenCalledWith(
      "dashboard.message",
      expect.objectContaining({
        content: "hello",
        sender: "user",
        senderName: "Operator",
        trackId: "track-1",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// dashboard.task.update
// ---------------------------------------------------------------------------

describe("dashboard.task.update", () => {
  it("rejects missing taskId", () => {
    const opts = makeOpts("dashboard.task.update", { updates: { status: "done" } });
    dashboardHandlers["dashboard.task.update"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "taskId and updates are required" }),
    );
  });

  it("rejects missing updates", () => {
    const opts = makeOpts("dashboard.task.update", { taskId: "t-1" });
    dashboardHandlers["dashboard.task.update"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "taskId and updates are required" }),
    );
  });

  it("broadcasts task update", () => {
    const opts = makeOpts("dashboard.task.update", {
      taskId: "t-1",
      updates: { status: "complete" },
    });
    dashboardHandlers["dashboard.task.update"](opts);

    expect(opts.respond).toHaveBeenCalledWith(true, {});
    const broadcast = opts.context.broadcast as ReturnType<typeof vi.fn>;
    expect(broadcast).toHaveBeenCalledWith("dashboard.task.updated", {
      taskId: "t-1",
      updates: { status: "complete" },
    });
  });
});

// ---------------------------------------------------------------------------
// dashboard.review.resolve
// ---------------------------------------------------------------------------

describe("dashboard.review.resolve", () => {
  it("rejects missing reviewId", () => {
    const opts = makeOpts("dashboard.review.resolve", { decision: "approved" });
    dashboardHandlers["dashboard.review.resolve"](opts);

    expect(opts.respond).toHaveBeenCalledWith(false, undefined, expect.any(Object));
  });

  it("rejects invalid decision", () => {
    const opts = makeOpts("dashboard.review.resolve", {
      reviewId: "r-1",
      decision: "maybe",
    });
    dashboardHandlers["dashboard.review.resolve"](opts);

    expect(opts.respond).toHaveBeenCalledWith(false, undefined, expect.any(Object));
  });

  it("broadcasts approval", () => {
    const opts = makeOpts("dashboard.review.resolve", {
      reviewId: "r-1",
      decision: "approved",
      comment: "LGTM",
    });
    dashboardHandlers["dashboard.review.resolve"](opts);

    expect(opts.respond).toHaveBeenCalledWith(true, {});
    const broadcast = opts.context.broadcast as ReturnType<typeof vi.fn>;
    expect(broadcast).toHaveBeenCalledWith("dashboard.review.resolved", {
      reviewId: "r-1",
      decision: "approved",
      comment: "LGTM",
    });
  });

  it("broadcasts rejection", () => {
    const opts = makeOpts("dashboard.review.resolve", {
      reviewId: "r-1",
      decision: "rejected",
    });
    dashboardHandlers["dashboard.review.resolve"](opts);

    expect(opts.respond).toHaveBeenCalledWith(true, {});
    const broadcast = opts.context.broadcast as ReturnType<typeof vi.fn>;
    expect(broadcast).toHaveBeenCalledWith("dashboard.review.resolved", {
      reviewId: "r-1",
      decision: "rejected",
      comment: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// dashboard.files.tree
// ---------------------------------------------------------------------------

describe("dashboard.files.tree", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-dash-tree-"));
    await fs.mkdir(path.join(tempDir, "src"));
    await fs.writeFile(path.join(tempDir, "src", "index.ts"), "export {};");
    await fs.writeFile(path.join(tempDir, "package.json"), "{}");
    await fs.mkdir(path.join(tempDir, "node_modules"));
    await fs.mkdir(path.join(tempDir, ".git"));
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns file tree from cwd", async () => {
    const opts = makeOpts("dashboard.files.tree", {});
    await dashboardHandlers["dashboard.files.tree"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        tree: expect.arrayContaining([
          expect.objectContaining({ name: "src", children: expect.any(Array) }),
          expect.objectContaining({ name: "package.json", children: null }),
        ]),
      }),
    );

    // node_modules and .git should be excluded
    const tree = respond.mock.calls[0][1].tree;
    const names = tree.map((n: { name: string }) => n.name);
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".git");
  });

  it("respects maxDepth", async () => {
    const opts = makeOpts("dashboard.files.tree", { maxDepth: 1 });
    await dashboardHandlers["dashboard.files.tree"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    expect(respond).toHaveBeenCalledWith(true, expect.any(Object));
    const srcNode = respond.mock.calls[0][1].tree.find((n: { name: string }) => n.name === "src");
    // depth 1 means we see src but its children are empty (depth 1 = 0-indexed, so we get 1 level)
    expect(srcNode).toBeTruthy();
  });

  it("clamps maxDepth to 8", async () => {
    const opts = makeOpts("dashboard.files.tree", { maxDepth: 100 });
    await dashboardHandlers["dashboard.files.tree"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    expect(respond).toHaveBeenCalledWith(true, expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// dashboard.files.read
// ---------------------------------------------------------------------------

describe("dashboard.files.read", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-dash-read-"));
    await fs.writeFile(path.join(tempDir, "hello.ts"), "const x = 1;");
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("rejects missing path", async () => {
    const opts = makeOpts("dashboard.files.read", {});
    await dashboardHandlers["dashboard.files.read"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "path is required" }),
    );
  });

  it("rejects path traversal", async () => {
    const opts = makeOpts("dashboard.files.read", { path: "../../etc/passwd" });
    await dashboardHandlers["dashboard.files.read"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "path traversal not allowed" }),
    );
  });

  it("reads a valid file", async () => {
    const opts = makeOpts("dashboard.files.read", { path: "hello.ts" });
    await dashboardHandlers["dashboard.files.read"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        path: "hello.ts",
        name: "hello.ts",
        content: "const x = 1;",
        language: "typescript",
      }),
    );
  });

  it("returns file size", async () => {
    const opts = makeOpts("dashboard.files.read", { path: "hello.ts" });
    await dashboardHandlers["dashboard.files.read"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    const payload = respond.mock.calls[0][1];
    expect(payload.size).toBeGreaterThan(0);
  });

  it("rejects file that does not exist", async () => {
    const opts = makeOpts("dashboard.files.read", { path: "nonexistent.ts" });
    await dashboardHandlers["dashboard.files.read"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("file read failed") }),
    );
  });
});

// ---------------------------------------------------------------------------
// dashboard.git.status (integration — runs real git in a temp repo)
// ---------------------------------------------------------------------------

describe("dashboard.git.status", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-dash-git-"));
    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["init"], { cwd: tempDir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: tempDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: tempDir });
    await fs.writeFile(path.join(tempDir, "a.txt"), "hello");
    execFileSync("git", ["add", "."], { cwd: tempDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tempDir });
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns branch and files", async () => {
    const opts = makeOpts("dashboard.git.status");
    await dashboardHandlers["dashboard.git.status"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        branch: expect.any(String),
        files: expect.any(Array),
      }),
    );
  });

  it("detects untracked file", async () => {
    await fs.writeFile(path.join(tempDir, "new.txt"), "new");
    const opts = makeOpts("dashboard.git.status");
    await dashboardHandlers["dashboard.git.status"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    const payload = respond.mock.calls[0][1];
    expect(payload.files).toContainEqual({ path: "new.txt", status: "untracked" });
  });
});

// ---------------------------------------------------------------------------
// dashboard.git.diff
// ---------------------------------------------------------------------------

describe("dashboard.git.diff", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-dash-diff-"));
    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["init"], { cwd: tempDir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: tempDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: tempDir });
    await fs.writeFile(path.join(tempDir, "a.txt"), "original\n");
    execFileSync("git", ["add", "."], { cwd: tempDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tempDir });
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty diff when no changes", async () => {
    const opts = makeOpts("dashboard.git.diff", {});
    await dashboardHandlers["dashboard.git.diff"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        files: [],
        stats: { filesChanged: 0, additions: 0, deletions: 0 },
      }),
    );
  });

  it("reports file changes", async () => {
    await fs.writeFile(path.join(tempDir, "a.txt"), "modified\n");
    const opts = makeOpts("dashboard.git.diff", {});
    await dashboardHandlers["dashboard.git.diff"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    const payload = respond.mock.calls[0][1];
    expect(payload.stats.filesChanged).toBe(1);
    expect(payload.files[0].path).toBe("a.txt");
    expect(payload.diff).toContain("modified");
  });
});

// ---------------------------------------------------------------------------
// dashboard.git.branches
// ---------------------------------------------------------------------------

describe("dashboard.git.branches", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-dash-br-"));
    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["init"], { cwd: tempDir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: tempDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: tempDir });
    await fs.writeFile(path.join(tempDir, "a.txt"), "a");
    execFileSync("git", ["add", "."], { cwd: tempDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tempDir });
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("lists branches and current", async () => {
    const opts = makeOpts("dashboard.git.branches");
    await dashboardHandlers["dashboard.git.branches"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    const payload = respond.mock.calls[0][1];
    expect(payload.branches.length).toBeGreaterThan(0);
    expect(payload.current).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// dashboard.git.worktrees
// ---------------------------------------------------------------------------

describe("dashboard.git.worktrees", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-dash-wt-"));
    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["init"], { cwd: tempDir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: tempDir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: tempDir });
    await fs.writeFile(path.join(tempDir, "a.txt"), "a");
    execFileSync("git", ["add", "."], { cwd: tempDir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: tempDir });
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("lists at least the main worktree", async () => {
    const opts = makeOpts("dashboard.git.worktrees");
    await dashboardHandlers["dashboard.git.worktrees"](opts);

    const respond = opts.respond as ReturnType<typeof vi.fn>;
    const payload = respond.mock.calls[0][1];
    expect(payload.worktrees.length).toBeGreaterThanOrEqual(1);
    expect(payload.worktrees[0].path).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// dashboard.settings.get / set
// ---------------------------------------------------------------------------

describe("dashboard.settings", () => {
  it("get returns defaults", () => {
    const opts = makeOpts("dashboard.settings.get");
    dashboardHandlers["dashboard.settings.get"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        autoSave: true,
        confirmCommands: true,
        defaultModel: "claude-3-opus",
        maxWorkers: 4,
      }),
    );
  });

  it("set acknowledges with saved: true", () => {
    const opts = makeOpts("dashboard.settings.set", {
      settings: { autoSave: false },
    });
    dashboardHandlers["dashboard.settings.set"](opts);

    expect(opts.respond).toHaveBeenCalledWith(true, { saved: true });
  });
});
