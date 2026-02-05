import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

function resolveSecurePath(requestedPath: string, root: string): string | null {
  const resolved = path.resolve(root, requestedPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

interface FileTreeNode {
  id: string;
  name: string;
  children: FileTreeNode[] | null;
}

const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".DS_Store", ".next", ".cache", "coverage"]);
const MAX_FILE_SIZE = 1_000_000; // 1 MB

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return "typescript";
    case "jsx":
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
    case "bash":
      return "shell";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "swift":
      return "swift";
    case "toml":
      return "toml";
    case "xml":
      return "xml";
    case "sql":
      return "sql";
    default:
      return "plaintext";
  }
}

async function buildFileTree(
  dirPath: string,
  root: string,
  depth: number,
  maxDepth: number,
): Promise<FileTreeNode[]> {
  if (depth >= maxDepth) return [];

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // Sort: directories first, then alphabetical
  entries.sort((a, b) => {
    const aDir = a.isDirectory() ? 0 : 1;
    const bDir = b.isDirectory() ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.name.localeCompare(b.name);
  });

  const nodes: FileTreeNode[] = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    // Skip hidden files/dirs (except common ones)
    if (entry.name.startsWith(".") && entry.name !== ".env.example" && entry.name !== ".github") continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(root, fullPath);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, root, depth + 1, maxDepth);
      nodes.push({ id: relPath, name: entry.name, children });
    } else {
      nodes.push({ id: relPath, name: entry.name, children: null });
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function gitExec(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, timeout: 10_000, maxBuffer: 2_000_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

interface GitStatusFile {
  path: string;
  status: string;
}

function parseGitStatusPorcelainV2(output: string): {
  branch: string;
  files: GitStatusFile[];
  ahead: number;
  behind: number;
} {
  const lines = output.split("\n").filter(Boolean);
  let branch = "";
  let ahead = 0;
  let behind = 0;
  const files: GitStatusFile[] = [];

  for (const line of lines) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length);
    } else if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(\d+) -(\d+)/);
      if (match) {
        ahead = Number.parseInt(match[1], 10);
        behind = Number.parseInt(match[2], 10);
      }
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      // Changed entries
      const parts = line.split(/\s+/);
      const statusCode = parts[1]; // XY status
      const filePath = line.startsWith("2 ") ? parts[parts.length - 1] : parts[parts.length - 1];
      let status = "modified";
      if (statusCode.startsWith("A") || statusCode.startsWith(".A")) status = "added";
      if (statusCode.startsWith("D") || statusCode.startsWith(".D")) status = "deleted";
      if (statusCode.startsWith("R")) status = "renamed";
      files.push({ path: filePath, status });
    } else if (line.startsWith("? ")) {
      files.push({ path: line.slice(2), status: "untracked" });
    }
  }

  return { branch, files, ahead, behind };
}

// ---------------------------------------------------------------------------
// In-memory dashboard state (simple, no persistence yet)
// ---------------------------------------------------------------------------

interface DashboardMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  trackId?: string;
}

const dashboardMessages: DashboardMessage[] = [];

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const dashboardHandlers: GatewayRequestHandlers = {
  // ---- Snapshot ----
  "dashboard.snapshot": ({ respond }) => {
    respond(true, {
      tracks: [],
      tasks: [],
      workers: [],
      messages: dashboardMessages,
      reviews: [],
      worktrees: [],
    });
  },

  // ---- Message send ----
  "dashboard.message.send": ({ params, respond, context }) => {
    const content = params.content as string | undefined;
    if (!content || typeof content !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "content is required"));
      return;
    }
    const trackId = params.trackId as string | undefined;
    const message: DashboardMessage = {
      id: randomUUID(),
      sender: "user",
      senderName: "Operator",
      content,
      timestamp: Date.now(),
      trackId,
    };
    dashboardMessages.push(message);
    context.broadcast("dashboard.message", message);
    respond(true, { messageId: message.id });
  },

  // ---- Task update ----
  "dashboard.task.update": ({ params, respond, context }) => {
    const taskId = params.taskId as string | undefined;
    const updates = params.updates as Record<string, unknown> | undefined;
    if (!taskId || !updates) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "taskId and updates are required"));
      return;
    }
    context.broadcast("dashboard.task.updated", { taskId, updates });
    respond(true, {});
  },

  // ---- Review resolve ----
  "dashboard.review.resolve": ({ params, respond, context }) => {
    const reviewId = params.reviewId as string | undefined;
    const decision = params.decision as string | undefined;
    if (!reviewId || !decision || !["approved", "rejected"].includes(decision)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "reviewId and decision (approved|rejected) are required"),
      );
      return;
    }
    const comment = params.comment as string | undefined;
    context.broadcast("dashboard.review.resolved", { reviewId, decision, comment });
    respond(true, {});
  },

  // ---- File System ----
  "dashboard.files.tree": async ({ params, respond }) => {
    const root = process.cwd();
    const maxDepth = Math.min(
      typeof params.maxDepth === "number" ? params.maxDepth : 5,
      8,
    );

    try {
      const tree = await buildFileTree(root, root, 0, maxDepth);
      respond(true, { tree });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `file tree failed: ${String(err)}`));
    }
  },

  "dashboard.files.read": async ({ params, respond }) => {
    const root = process.cwd();
    const filePath = params.path as string | undefined;
    if (!filePath || typeof filePath !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path is required"));
      return;
    }

    const resolved = resolveSecurePath(filePath, root);
    if (!resolved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path traversal not allowed"));
      return;
    }

    try {
      const stat = await fs.stat(resolved);
      if (stat.size > MAX_FILE_SIZE) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "file too large (>1MB)"));
        return;
      }
      const content = await fs.readFile(resolved, "utf-8");
      const name = path.basename(resolved);
      respond(true, {
        path: filePath,
        name,
        content,
        size: stat.size,
        language: detectLanguage(name),
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `file read failed: ${String(err)}`));
    }
  },

  // ---- Git ----
  "dashboard.git.status": async ({ respond }) => {
    const cwd = process.cwd();
    try {
      const output = await gitExec(["status", "--porcelain=v2", "-b"], cwd);
      const parsed = parseGitStatusPorcelainV2(output);
      respond(true, parsed);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `git status failed: ${String(err)}`));
    }
  },

  "dashboard.git.diff": async ({ params, respond }) => {
    const cwd = process.cwd();
    const base = (params.base as string) || "HEAD";
    try {
      const [numstatOut, diffOut] = await Promise.all([
        gitExec(["diff", "--numstat", base], cwd),
        gitExec(["diff", base], cwd),
      ]);

      const files = numstatOut
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [add, del, filePath] = line.split("\t");
          return {
            path: filePath,
            additions: Number.parseInt(add, 10) || 0,
            deletions: Number.parseInt(del, 10) || 0,
          };
        });

      const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

      respond(true, {
        files,
        diff: diffOut,
        stats: {
          filesChanged: files.length,
          additions: totalAdditions,
          deletions: totalDeletions,
        },
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `git diff failed: ${String(err)}`));
    }
  },

  "dashboard.git.branches": async ({ respond }) => {
    const cwd = process.cwd();
    try {
      const [branchOut, headOut] = await Promise.all([
        gitExec(["branch", "-a", "--format=%(refname:short)\t%(objectname:short)"], cwd),
        gitExec(["rev-parse", "--abbrev-ref", "HEAD"], cwd),
      ]);

      const branches = branchOut
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [name, sha] = line.split("\t");
          return { name, sha };
        });

      respond(true, { branches, current: headOut.trim() });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `git branches failed: ${String(err)}`));
    }
  },

  "dashboard.git.worktrees": async ({ respond }) => {
    const cwd = process.cwd();
    try {
      const output = await gitExec(["worktree", "list", "--porcelain"], cwd);
      const worktrees: { path: string; head: string; branch: string }[] = [];
      let current: { path: string; head: string; branch: string } | null = null;

      for (const line of output.split("\n")) {
        if (line.startsWith("worktree ")) {
          if (current) worktrees.push(current);
          current = { path: line.slice("worktree ".length), head: "", branch: "" };
        } else if (line.startsWith("HEAD ") && current) {
          current.head = line.slice("HEAD ".length);
        } else if (line.startsWith("branch ") && current) {
          current.branch = line.slice("branch ".length).replace("refs/heads/", "");
        }
      }
      if (current) worktrees.push(current);

      respond(true, { worktrees });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `git worktrees failed: ${String(err)}`));
    }
  },

  // ---- Settings ----
  "dashboard.settings.get": ({ respond }) => {
    // Return defaults for now — could read from config later
    respond(true, {
      autoSave: true,
      confirmCommands: true,
      defaultModel: "claude-3-opus",
      maxWorkers: 4,
    });
  },

  "dashboard.settings.set": ({ params, respond }) => {
    // Accept and acknowledge — persistence can be added later
    void (params.settings ?? params);
    respond(true, { saved: true });
  },
};
