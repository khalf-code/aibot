/**
 * Smart Model Router - Logging Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RoutingResult, RoutingContext } from "./types.js";
import { MODELS } from "./config.js";
import {
  setLogger,
  setVerbose,
  logRoutingDecision,
  logRoutingError,
  logMetricsSummary,
  formatRoutingResult,
  consoleLogger,
  silentLogger,
} from "./logging.js";

describe("logging", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setLogger(mockLogger);
    setVerbose(false);
  });

  describe("consoleLogger", () => {
    it("has all required methods", () => {
      expect(typeof consoleLogger.debug).toBe("function");
      expect(typeof consoleLogger.info).toBe("function");
      expect(typeof consoleLogger.warn).toBe("function");
      expect(typeof consoleLogger.error).toBe("function");
    });
  });

  describe("silentLogger", () => {
    it("has all required methods", () => {
      expect(typeof silentLogger.debug).toBe("function");
      expect(typeof silentLogger.info).toBe("function");
      expect(typeof silentLogger.warn).toBe("function");
      expect(typeof silentLogger.error).toBe("function");
    });

    it("does not throw", () => {
      expect(() => silentLogger.debug("test")).not.toThrow();
      expect(() => silentLogger.info("test")).not.toThrow();
      expect(() => silentLogger.warn("test")).not.toThrow();
      expect(() => silentLogger.error("test")).not.toThrow();
    });
  });

  describe("logRoutingDecision", () => {
    it("logs basic routing decision", () => {
      const result: RoutingResult = {
        model: { provider: "anthropic", model: MODELS.HAIKU },
        rule: "default",
        cleanedMessage: "hello",
        wasExplicitOverride: false,
      };

      logRoutingDecision(result);

      expect(mockLogger.info).toHaveBeenCalled();
      const message = mockLogger.info.mock.calls[0][0];
      expect(message).toContain("haiku");
      expect(message).toContain("default");
    });

    it("indicates explicit override", () => {
      const result: RoutingResult = {
        model: { provider: "anthropic", model: MODELS.OPUS },
        rule: "override:claude-opus-4-5",
        cleanedMessage: "test",
        wasExplicitOverride: true,
      };

      logRoutingDecision(result);

      const message = mockLogger.info.mock.calls[0][0];
      expect(message).toContain("[explicit]");
    });

    it("includes context in verbose mode", () => {
      setVerbose(true);

      const result: RoutingResult = {
        model: { provider: "anthropic", model: MODELS.HAIKU },
        rule: "task:heartbeat",
        cleanedMessage: "test",
        wasExplicitOverride: false,
      };

      const context: RoutingContext = {
        message: "test",
        taskType: "heartbeat",
        agentId: "main",
        promptTokens: 100,
      };

      logRoutingDecision(result, context);

      const message = mockLogger.info.mock.calls[0][0];
      expect(message).toContain("task=heartbeat");
      expect(message).toContain("agent=main");
      expect(message).toContain("tokens=100");
    });

    it("excludes context when not verbose", () => {
      setVerbose(false);

      const result: RoutingResult = {
        model: { provider: "anthropic", model: MODELS.HAIKU },
        rule: "default",
        cleanedMessage: "test",
        wasExplicitOverride: false,
      };

      const context: RoutingContext = {
        message: "test",
        taskType: "heartbeat",
      };

      logRoutingDecision(result, context);

      const message = mockLogger.info.mock.calls[0][0];
      expect(message).not.toContain("task=");
    });
  });

  describe("logRoutingError", () => {
    it("logs Error objects", () => {
      const error = new Error("test error");
      logRoutingError(error);

      expect(mockLogger.error).toHaveBeenCalled();
      const message = mockLogger.error.mock.calls[0][0];
      expect(message).toContain("test error");
    });

    it("logs string errors", () => {
      logRoutingError("string error");

      const message = mockLogger.error.mock.calls[0][0];
      expect(message).toContain("string error");
    });

    it("logs other types", () => {
      logRoutingError({ code: 123 });

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("logMetricsSummary", () => {
    it("logs summary with emoji", () => {
      logMetricsSummary("haiku: 10 | opus: 2 | saved ~$1.50");

      expect(mockLogger.info).toHaveBeenCalled();
      const message = mockLogger.info.mock.calls[0][0];
      expect(message).toContain("📊");
      expect(message).toContain("Routing");
    });
  });

  describe("formatRoutingResult", () => {
    it("formats Haiku result", () => {
      const result: RoutingResult = {
        model: { provider: "anthropic", model: MODELS.HAIKU },
        rule: "default",
        cleanedMessage: "",
        wasExplicitOverride: false,
      };

      const formatted = formatRoutingResult(result);
      expect(formatted).toContain("haiku");
      expect(formatted).toContain("default");
    });

    it("formats Opus 4.5 result", () => {
      const result: RoutingResult = {
        model: { provider: "anthropic", model: MODELS.OPUS },
        rule: "coding-agent",
        cleanedMessage: "",
        wasExplicitOverride: false,
      };

      const formatted = formatRoutingResult(result);
      expect(formatted).toContain("opus");
      expect(formatted).toContain("4.5");
    });

    it("formats Sonnet result", () => {
      const result: RoutingResult = {
        model: { provider: "anthropic", model: MODELS.SONNET },
        rule: "override",
        cleanedMessage: "",
        wasExplicitOverride: true,
      };

      const formatted = formatRoutingResult(result);
      expect(formatted).toContain("sonnet");
    });
  });

  describe("setLogger", () => {
    it("uses custom logger", () => {
      const customLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      setLogger(customLogger);
      logRoutingError("test");

      expect(customLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
