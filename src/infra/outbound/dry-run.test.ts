import { describe, expect, it } from "vitest";
import { isDryRunModeEnabled } from "./dry-run.js";

describe("dry-run", () => {
  describe("isDryRunModeEnabled", () => {
    it("returns true when CLAWDBOT_DRY_RUN=true", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "true" })).toBe(true);
    });

    it("returns true when CLAWDBOT_DRY_RUN=1", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "1" })).toBe(true);
    });

    it("returns true when CLAWDBOT_DRY_RUN=yes", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "yes" })).toBe(true);
    });

    it("returns true when CLAWDBOT_DRY_RUN=TRUE (case insensitive)", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "TRUE" })).toBe(true);
    });

    it("returns false when CLAWDBOT_DRY_RUN=false", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "false" })).toBe(false);
    });

    it("returns false when CLAWDBOT_DRY_RUN=0", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "0" })).toBe(false);
    });

    it("returns false when CLAWDBOT_DRY_RUN is not set", () => {
      expect(isDryRunModeEnabled({})).toBe(false);
    });

    it("returns false when CLAWDBOT_DRY_RUN is empty string", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "" })).toBe(false);
    });

    it("returns false for arbitrary string values", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "enabled" })).toBe(false);
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "on" })).toBe(false);
    });

    it("handles whitespace in value", () => {
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "  true  " })).toBe(true);
      expect(isDryRunModeEnabled({ CLAWDBOT_DRY_RUN: "  1  " })).toBe(true);
    });
  });
});
