import { describe, expect, it } from "vitest";
import {
  resolveProjectFromChannel,
  resolveProjectDbPath,
  type ProjectConfig,
} from "./project-scope.js";

describe("resolveProjectFromChannel", () => {
  const projects: ProjectConfig[] = [
    { id: "backend", name: "Backend", channels: ["#backend", "#api-bugs"] },
    { id: "frontend", name: "Frontend", channels: ["#frontend", "#ui-issues"] },
  ];

  it("matches channel to project", () => {
    const result = resolveProjectFromChannel({
      channelName: "#backend",
      projects,
    });
    expect(result?.id).toBe("backend");
  });

  it("returns undefined for unmatched channel", () => {
    const result = resolveProjectFromChannel({
      channelName: "#random",
      projects,
    });
    expect(result).toBeUndefined();
  });

  it("normalizes channel name (strips #)", () => {
    const result = resolveProjectFromChannel({
      channelName: "backend",
      projects,
    });
    expect(result?.id).toBe("backend");
  });
});

describe("resolveProjectDbPath", () => {
  it("returns project-specific path", () => {
    const result = resolveProjectDbPath({
      agentId: "main",
      projectId: "backend",
      baseDir: "/home/user/.openclaw/state/memory",
    });
    expect(result).toBe("/home/user/.openclaw/state/memory/main/projects/backend.sqlite");
  });

  it("returns global path when no project", () => {
    const result = resolveProjectDbPath({
      agentId: "main",
      projectId: undefined,
      baseDir: "/home/user/.openclaw/state/memory",
    });
    expect(result).toBe("/home/user/.openclaw/state/memory/main/_global.sqlite");
  });
});
