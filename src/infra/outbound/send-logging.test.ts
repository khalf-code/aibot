import { describe, expect, it } from "vitest";
import { formatSendLogLine, inferSendSource, type SendLogContext } from "./send-logging.js";

describe("send-logging", () => {
  describe("formatSendLogLine", () => {
    it("formats basic send context", () => {
      const ctx: SendLogContext = {
        source: "cli",
        channel: "whatsapp",
        target: "+16505551234",
        resolvedFrom: "explicit",
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("source=cli");
      expect(line).toContain("channel=whatsapp");
      expect(line).toContain("target=+165***1234");
      expect(line).toContain("resolvedFrom=explicit");
    });

    it("includes session key when provided", () => {
      const ctx: SendLogContext = {
        source: "session",
        sessionKey: "agent:main:telegram:12345",
        channel: "telegram",
        target: "12345",
        resolvedFrom: "session",
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("sessionKey=agent:main:telegram:12345");
    });

    it("includes resolved target when different from target", () => {
      const ctx: SendLogContext = {
        source: "rpc",
        channel: "whatsapp",
        target: "John",
        resolvedTarget: "+16505551234",
        resolvedFrom: "directory",
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("resolvedTarget=+165***1234");
    });

    it("omits resolved target when same as target", () => {
      const ctx: SendLogContext = {
        source: "cli",
        channel: "whatsapp",
        target: "+16505551234",
        resolvedTarget: "+16505551234",
        resolvedFrom: "explicit",
      };
      const line = formatSendLogLine(ctx);
      expect(line).not.toContain("resolvedTarget=");
    });

    it("includes dry-run flag", () => {
      const ctx: SendLogContext = {
        source: "cli",
        channel: "whatsapp",
        target: "+16505551234",
        resolvedFrom: "explicit",
        dryRun: true,
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("dryRun=true");
    });

    it("includes first-time recipient flag", () => {
      const ctx: SendLogContext = {
        source: "rpc",
        channel: "whatsapp",
        target: "+16505551234",
        resolvedFrom: "explicit",
        firstTimeRecipient: true,
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("firstTime=true");
    });

    it("masks phone numbers correctly", () => {
      const ctx: SendLogContext = {
        source: "cli",
        channel: "whatsapp",
        target: "+16505551234",
        resolvedFrom: "explicit",
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("+165***1234");
      expect(line).not.toContain("+16505551234");
    });

    it("masks WhatsApp JIDs correctly", () => {
      const ctx: SendLogContext = {
        source: "rpc",
        channel: "whatsapp",
        target: "16505551234@s.whatsapp.net",
        resolvedFrom: "explicit",
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("165***234@s.whatsapp.net");
    });

    it("does not mask group JIDs", () => {
      const ctx: SendLogContext = {
        source: "rpc",
        channel: "whatsapp",
        target: "1234567890@g.us",
        resolvedFrom: "explicit",
      };
      const line = formatSendLogLine(ctx);
      expect(line).toContain("1234567890@g.us");
    });
  });

  describe("inferSendSource", () => {
    it("returns sub-agent when isSubagent is true", () => {
      expect(inferSendSource({ isSubagent: true })).toBe("sub-agent");
    });

    it("returns tool when isTool is true", () => {
      expect(inferSendSource({ isTool: true })).toBe("tool");
    });

    it("returns rpc when isRpc is true", () => {
      expect(inferSendSource({ isRpc: true })).toBe("rpc");
    });

    it("returns cli when isCli is true", () => {
      expect(inferSendSource({ isCli: true })).toBe("cli");
    });

    it("returns session when sessionKey is provided", () => {
      expect(inferSendSource({ sessionKey: "agent:main:telegram:123" })).toBe("session");
    });

    it("returns unknown when nothing is provided", () => {
      expect(inferSendSource({})).toBe("unknown");
    });

    it("prioritizes sub-agent over other sources", () => {
      expect(inferSendSource({ isSubagent: true, isRpc: true, isCli: true })).toBe("sub-agent");
    });
  });
});
