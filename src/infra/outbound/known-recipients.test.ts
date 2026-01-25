import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearKnownRecipientsCache,
  getKnownRecipientsStats,
  isKnownRecipient,
  recordRecipient,
} from "./known-recipients.js";

// Mock the state dir resolution
vi.mock("../../config/paths.js", () => ({
  resolveStateDir: () => testStateDir,
}));

let testStateDir: string;

beforeEach(async () => {
  testStateDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "clawdbot-known-recipients-"));
  clearKnownRecipientsCache();
});

afterEach(async () => {
  await fs.promises.rm(testStateDir, { recursive: true, force: true });
});

describe("known-recipients", () => {
  describe("isKnownRecipient", () => {
    it("returns false for unknown recipient", () => {
      expect(isKnownRecipient("whatsapp", "+16505551234")).toBe(false);
    });

    it("returns true after recording recipient", () => {
      recordRecipient("whatsapp", "+16505551234");
      expect(isKnownRecipient("whatsapp", "+16505551234")).toBe(true);
    });

    it("normalizes WhatsApp JIDs to E.164", () => {
      recordRecipient("whatsapp", "16505551234@s.whatsapp.net");
      expect(isKnownRecipient("whatsapp", "+16505551234")).toBe(true);
    });

    it("differentiates between channels", () => {
      recordRecipient("whatsapp", "+16505551234");
      expect(isKnownRecipient("telegram", "+16505551234")).toBe(false);
    });
  });

  describe("recordRecipient", () => {
    it("returns true for first-time recipient", () => {
      const isFirstTime = recordRecipient("whatsapp", "+16505551234");
      expect(isFirstTime).toBe(true);
    });

    it("returns false for known recipient", () => {
      recordRecipient("whatsapp", "+16505551234");
      const isFirstTime = recordRecipient("whatsapp", "+16505551234");
      expect(isFirstTime).toBe(false);
    });

    it("increments send count on subsequent sends", () => {
      recordRecipient("whatsapp", "+16505551234");
      recordRecipient("whatsapp", "+16505551234");
      recordRecipient("whatsapp", "+16505551234");

      const stats = getKnownRecipientsStats();
      expect(stats.total).toBe(1);
    });

    it("persists data to disk", () => {
      recordRecipient("whatsapp", "+16505551234");
      clearKnownRecipientsCache();
      expect(isKnownRecipient("whatsapp", "+16505551234")).toBe(true);
    });
  });

  describe("getKnownRecipientsStats", () => {
    it("returns empty stats when no recipients", () => {
      const stats = getKnownRecipientsStats();
      expect(stats.total).toBe(0);
      expect(stats.byChannel).toEqual({});
    });

    it("returns correct stats after recording", () => {
      recordRecipient("whatsapp", "+16505551234");
      recordRecipient("whatsapp", "+16505555678");
      recordRecipient("telegram", "12345");

      const stats = getKnownRecipientsStats();
      expect(stats.total).toBe(3);
      expect(stats.byChannel.whatsapp).toBe(2);
      expect(stats.byChannel.telegram).toBe(1);
    });
  });
});
