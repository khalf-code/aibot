import { createHash } from "node:crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";
import {
  clearContextFileCache,
  computeFileChecksum,
  getContextFileCache,
  resolveBootstrapContextForRun,
  setContextFileCache,
} from "./bootstrap-files.js";

describe("computeFileChecksum", () => {
  it("computes SHA256 checksum for string content", () => {
    const content = "Hello, World!";
    const checksum = computeFileChecksum(content);

    // Verify it's a valid hex string
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);

    // Verify consistency
    expect(computeFileChecksum(content)).toBe(checksum);
  });

  it("produces different checksums for different content", () => {
    const checksum1 = computeFileChecksum("content1");
    const checksum2 = computeFileChecksum("content2");

    expect(checksum1).not.toBe(checksum2);
  });

  it("handles empty string", () => {
    const checksum = computeFileChecksum("");

    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(checksum).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("ContextFileCache", () => {
  const sessionKey = "test-session-123";

  beforeEach(() => {
    clearContextFileCache(sessionKey);
  });

  afterEach(() => {
    clearContextFileCache(sessionKey);
  });

  it("stores and retrieves cache entry", () => {
    const fileName = "AGENTS.md";
    const checksum = "abc123";
    const content = "test content";

    setContextFileCache(sessionKey, fileName, checksum, content);
    const cached = getContextFileCache(sessionKey, fileName);

    expect(cached).toEqual({ checksum, content });
  });

  it("returns null for uncached files", () => {
    const cached = getContextFileCache(sessionKey, "NOT_CACHED.md");
    expect(cached).toBeNull();
  });

  it("updates cache entry when set again", () => {
    const fileName = "AGENTS.md";

    setContextFileCache(sessionKey, fileName, "checksum1", "content1");
    setContextFileCache(sessionKey, fileName, "checksum2", "content2");

    const cached = getContextFileCache(sessionKey, fileName);
    expect(cached).toEqual({ checksum: "checksum2", content: "content2" });
  });

  it("clears cache for specific session", () => {
    setContextFileCache(sessionKey, "AGENTS.md", "checksum", "content");
    clearContextFileCache(sessionKey);

    const cached = getContextFileCache(sessionKey, "AGENTS.md");
    expect(cached).toBeNull();
  });

  it("isolates cache between sessions", () => {
    const sessionKey2 = "test-session-456";

    setContextFileCache(sessionKey, "AGENTS.md", "checksum1", "content1");
    setContextFileCache(sessionKey2, "AGENTS.md", "checksum2", "content2");

    expect(getContextFileCache(sessionKey, "AGENTS.md")).toEqual({
      checksum: "checksum1",
      content: "content1",
    });
    expect(getContextFileCache(sessionKey2, "AGENTS.md")).toEqual({
      checksum: "checksum2",
      content: "content2",
    });
  });
});

describe("resolveBootstrapContextForRun with cache", () => {
  const sessionKey = "test-session-cache";

  beforeEach(() => {
    clearContextFileCache(sessionKey);
  });

  afterEach(() => {
    clearContextFileCache(sessionKey);
  });

  it("caches context files after first call", async () => {
    const tempDir = await makeTempWorkspace("openclaw-cache-test-");

    // Create AGENTS.md
    const agentsContent = "# Test AGENTS\n\nThis is a test.";
    await writeWorkspaceFile({
      dir: tempDir,
      name: "AGENTS.md",
      content: agentsContent,
    });

    // First call - should populate cache
    const result1 = await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    // Should return all bootstrap files (AGENTS.md, SOUL.md, etc.)
    expect(result1.contextFiles.length).toBeGreaterThan(0);
    const agentsFile = result1.contextFiles.find((f) => f.path === "AGENTS.md");
    expect(agentsFile?.content).toContain("Test AGENTS");

    // Verify cache was populated
    const cached = getContextFileCache(sessionKey, "AGENTS.md");
    expect(cached).not.toBeNull();
    expect(cached?.checksum).toBe(computeFileChecksum(agentsContent));
    expect(cached?.content).toBe(agentsFile?.content);
  });

  it("returns cached content when file unchanged", async () => {
    const tempDir = await makeTempWorkspace("openclaw-cache-test-");

    const agentsContent = "# Cached Content\n\nVersion 1.";
    await writeWorkspaceFile({
      dir: tempDir,
      name: "AGENTS.md",
      content: agentsContent,
    });

    // First call
    const result1 = await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    // Second call with same content - should use cache
    const result2 = await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    expect(result2.contextFiles.length).toBeGreaterThan(0);
    const agentsFile1 = result1.contextFiles.find((f) => f.path === "AGENTS.md");
    const agentsFile2 = result2.contextFiles.find((f) => f.path === "AGENTS.md");
    expect(agentsFile2?.content).toBe(agentsFile1?.content);
  });

  it("updates cache when file content changes", async () => {
    const tempDir = await makeTempWorkspace("openclaw-cache-test-");

    // Create initial file
    await writeWorkspaceFile({
      dir: tempDir,
      name: "AGENTS.md",
      content: "# Version 1",
    });

    // First call
    await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    const cached1 = getContextFileCache(sessionKey, "AGENTS.md");

    // Update file
    await writeWorkspaceFile({
      dir: tempDir,
      name: "AGENTS.md",
      content: "# Version 2\n\nUpdated content.",
    });

    // Second call - should detect change
    const result2 = await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    const cached2 = getContextFileCache(sessionKey, "AGENTS.md");

    expect(result2.contextFiles[0]?.content).toContain("Version 2");
    expect(cached2?.checksum).not.toBe(cached1?.checksum);
  });

  it("handles missing files with cache", async () => {
    const tempDir = await makeTempWorkspace("openclaw-cache-test-");

    // Don't create AGENTS.md - it will be missing

    const result = await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    // Should still return missing marker
    expect(result.contextFiles.length).toBeGreaterThan(0);
    const agentsFile = result.contextFiles.find((f) => f.path === "AGENTS.md");
    expect(agentsFile?.content).toContain("[MISSING]");
  });

  it("isolates cache between different sessions", async () => {
    const tempDir = await makeTempWorkspace("openclaw-cache-test-");
    const sessionKey2 = "test-session-other";

    await writeWorkspaceFile({
      dir: tempDir,
      name: "AGENTS.md",
      content: "# Shared Content",
    });

    // Call with different sessions
    await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey: sessionKey2,
    });

    // Each session should have its own cache
    expect(getContextFileCache(sessionKey, "AGENTS.md")).not.toBeNull();
    expect(getContextFileCache(sessionKey2, "AGENTS.md")).not.toBeNull();

    // Clean up second session
    clearContextFileCache(sessionKey2);
  });

  it("caches empty/whitespace-only files correctly", async () => {
    const tempDir = await makeTempWorkspace("openclaw-cache-test-");

    // Create AGENTS.md with only whitespace
    await writeWorkspaceFile({
      dir: tempDir,
      name: "AGENTS.md",
      content: "   \n\n   ",
    });

    // First call
    await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    // Verify cache was populated with empty content
    const cached = getContextFileCache(sessionKey, "AGENTS.md");
    expect(cached).not.toBeNull();
    expect(cached?.content).toBe(""); // Empty after trimming

    // Second call - should use cache and not reprocess
    const result2 = await resolveBootstrapContextForRun({
      workspaceDir: tempDir,
      sessionKey,
    });

    // AGENTS.md should not be in result (empty content), but cache should exist
    const agentsFile = result2.contextFiles.find((f) => f.path === "AGENTS.md");
    expect(agentsFile).toBeUndefined(); // Not included in result (empty)
    expect(getContextFileCache(sessionKey, "AGENTS.md")).not.toBeNull(); // But cached!
  });
});
