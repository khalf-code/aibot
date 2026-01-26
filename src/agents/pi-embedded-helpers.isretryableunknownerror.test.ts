import { describe, expect, it } from "vitest";
import {
  isRetryableUnknownError,
  isRetryableUnknownAssistantError,
} from "./pi-embedded-helpers.js";
import type { AssistantMessage } from "@mariozechner/pi-ai";

describe("isRetryableUnknownError", () => {
  it("matches generic unknown error patterns from pi-mono providers", () => {
    const samples = [
      "Unknown error",
      "unknown error",
      "An unknown error occurred",
      "an unknown error occurred",
      "An unkown error ocurred", // typo variant from pi-mono
      "Response failed",
      "response failed",
      "Unknown error: something went wrong",
    ];
    for (const sample of samples) {
      expect(isRetryableUnknownError(sample)).toBe(true);
    }
  });

  it("does not match classified error types (these have specific handling)", () => {
    const samples = [
      "rate limit exceeded",
      "429 Too Many Requests",
      "unauthorized",
      "authentication failed",
      "context length exceeded",
      "prompt is too long",
      "overloaded_error",
      "timeout",
      "timed out",
      "billing",
      "payment required",
    ];
    for (const sample of samples) {
      expect(isRetryableUnknownError(sample)).toBe(false);
    }
  });

  it("does not match empty or undefined", () => {
    expect(isRetryableUnknownError(undefined)).toBe(false);
    expect(isRetryableUnknownError("")).toBe(false);
    expect(isRetryableUnknownError("   ")).toBe(false);
  });

  it("does not match specific error messages that happen to contain 'unknown'", () => {
    // These are not the generic "unknown error" pattern we want to retry
    expect(isRetryableUnknownError("Unknown model: gpt-5")).toBe(false);
    expect(isRetryableUnknownError("Unknown tool: some_tool")).toBe(false);
  });
});

describe("isRetryableUnknownAssistantError", () => {
  const makeAssistant = (stopReason: string, errorMessage?: string): AssistantMessage => ({
    role: "assistant",
    content: [],
    stopReason: stopReason as AssistantMessage["stopReason"],
    errorMessage,
    api: "anthropic",
    provider: "anthropic",
    model: "claude-3-sonnet",
    timestamp: Date.now(),
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  });

  it("returns true for error stopReason with unknown error message", () => {
    const msg = makeAssistant("error", "An unknown error occurred");
    expect(isRetryableUnknownAssistantError(msg)).toBe(true);
  });

  it("returns false for non-error stopReason", () => {
    const msg = makeAssistant("stop", "An unknown error occurred");
    expect(isRetryableUnknownAssistantError(msg)).toBe(false);
  });

  it("returns false for error stopReason with classified error message", () => {
    const msg = makeAssistant("error", "rate limit exceeded");
    expect(isRetryableUnknownAssistantError(msg)).toBe(false);
  });

  it("returns false for undefined message", () => {
    expect(isRetryableUnknownAssistantError(undefined)).toBe(false);
  });
});
