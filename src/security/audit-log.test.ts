import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { AuditLogger, initAuditLogger, getAuditLogger, audit, type AuditLogConfig } from "./audit-log.js";

const TEST_DIR = join(process.cwd(), ".test-audit-logs");
const TEST_LOG_PATH = join(TEST_DIR, "test-audit.log");

describe("AuditLogger", () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("basic logging", () => {
    it("should create log file and write entries", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
      });

      logger.log({
        category: "auth",
        action: "auth.login",
        message: "User logged in",
        actor: { type: "user", id: "user123" },
      });

      await logger.close();

      expect(existsSync(TEST_LOG_PATH)).toBe(true);
      const content = readFileSync(TEST_LOG_PATH, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.category).toBe("auth");
      expect(entry.action).toBe("auth.login");
      expect(entry.message).toBe("User logged in");
      expect(entry.actor.id).toBe("user123");
      expect(entry.seq).toBe(1);
    });

    it("should increment sequence numbers", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
      });

      logger.log({ category: "auth", action: "auth.login", message: "First" });
      logger.log({ category: "auth", action: "auth.logout", message: "Second" });
      logger.log({ category: "exec", action: "exec.run", message: "Third" });

      await logger.close();

      const lines = readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
      expect(lines.length).toBe(3);
      expect(JSON.parse(lines[0]).seq).toBe(1);
      expect(JSON.parse(lines[1]).seq).toBe(2);
      expect(JSON.parse(lines[2]).seq).toBe(3);
    });
  });

  describe("filtering", () => {
    it("should filter by category", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
        categories: ["auth", "exec"],
      });

      logger.log({ category: "auth", action: "auth.login", message: "Auth event" });
      logger.log({ category: "config", action: "config.write", message: "Config event" });
      logger.log({ category: "exec", action: "exec.run", message: "Exec event" });

      await logger.close();

      const lines = readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0]).category).toBe("auth");
      expect(JSON.parse(lines[1]).category).toBe("exec");
    });

    it("should filter by severity", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
        minSeverity: "warn",
      });

      logger.log({ category: "auth", action: "auth.login", severity: "info", message: "Info" });
      logger.log({ category: "auth", action: "auth.failed", severity: "warn", message: "Warn" });
      logger.log({ category: "exec", action: "exec.blocked", severity: "critical", message: "Critical" });

      await logger.close();

      const lines = readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0]).severity).toBe("warn");
      expect(JSON.parse(lines[1]).severity).toBe("critical");
    });
  });

  describe("PII redaction", () => {
    it("should redact email addresses", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
        redactPii: true,
      });

      logger.log({
        category: "auth",
        action: "auth.login",
        message: "User test@example.com logged in",
      });

      await logger.close();

      const content = readFileSync(TEST_LOG_PATH, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.message).toBe("User [REDACTED] logged in");
    });

    it("should redact API keys", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
        redactPii: true,
      });

      logger.log({
        category: "config",
        action: "config.write",
        message: "Saved config",
        context: { token: "sk-ant-abc123xyz" },
      });

      await logger.close();

      const content = readFileSync(TEST_LOG_PATH, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.context.token).toBe("[REDACTED]");
    });

    it("should not redact when disabled", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
        redactPii: false,
      });

      logger.log({
        category: "auth",
        action: "auth.login",
        message: "User test@example.com logged in",
      });

      await logger.close();

      const content = readFileSync(TEST_LOG_PATH, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.message).toBe("User test@example.com logged in");
    });
  });

  describe("tamper-evident chain", () => {
    it("should include prev_hash when enabled", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
        enableChain: true,
      });

      logger.log({ category: "auth", action: "auth.login", message: "First" });
      logger.log({ category: "auth", action: "auth.logout", message: "Second" });

      await logger.close();

      const lines = readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
      const first = JSON.parse(lines[0]);
      const second = JSON.parse(lines[1]);

      expect(first.prev_hash).toBeUndefined();
      expect(second.prev_hash).toBeDefined();
      expect(second.prev_hash.length).toBe(16);
    });
  });

  describe("convenience methods", () => {
    it("should log auth events", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
      });

      logger.auth("auth.login", {
        message: "User authenticated",
        actor: { type: "user", id: "user123" },
      });

      await logger.close();

      const content = readFileSync(TEST_LOG_PATH, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.category).toBe("auth");
      expect(entry.action).toBe("auth.login");
    });

    it("should log exec events", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
      });

      logger.exec("exec.run", {
        message: "Executed command",
        command: "ls -la",
        actor: { type: "agent", id: "main" },
        result: { success: true, duration_ms: 50 },
      });

      await logger.close();

      const content = readFileSync(TEST_LOG_PATH, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.category).toBe("exec");
      expect(entry.target.id).toBe("ls -la");
      expect(entry.result.duration_ms).toBe(50);
    });

    it("should log tool invocations", async () => {
      const logger = new AuditLogger({
        enabled: true,
        path: TEST_LOG_PATH,
      });

      logger.tool("tool.invoke", {
        toolName: "web_search",
        message: "Invoked web search",
        context: { query: "test query" },
      });

      await logger.close();

      const content = readFileSync(TEST_LOG_PATH, "utf-8");
      const entry = JSON.parse(content.trim());
      expect(entry.category).toBe("tool");
      expect(entry.target.id).toBe("web_search");
    });
  });

  describe("global instance", () => {
    it("should use singleton pattern", () => {
      const logger1 = getAuditLogger();
      const logger2 = getAuditLogger();
      expect(logger1).toBe(logger2);
    });

    it("should allow reinitialization", async () => {
      const logger1 = initAuditLogger({ path: TEST_LOG_PATH });
      const logger2 = initAuditLogger({ path: join(TEST_DIR, "other.log") });
      expect(logger1).not.toBe(logger2);
      await logger2.close();
    });
  });

  describe("audit shorthand", () => {
    beforeEach(() => {
      initAuditLogger({ enabled: true, path: TEST_LOG_PATH });
    });

    afterEach(async () => {
      await getAuditLogger().close();
    });

    it("should provide shorthand methods", async () => {
      audit.auth("auth.login", { message: "Test" });
      audit.exec("exec.run", { message: "Test", command: "echo" });
      audit.tool("tool.invoke", { toolName: "test", message: "Test" });

      await getAuditLogger().close();

      const lines = readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
      expect(lines.length).toBe(3);
    });
  });
});
