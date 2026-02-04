import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackInboxConfig } from "./config.js";
import { runSync, type SyncContext } from "./sync.js";

// Mock modules
vi.mock("./api/slack.js", () => ({
  createSlackClient: vi.fn(() => ({})),
  listBotChannels: vi.fn(),
  fetchChannelMessages: vi.fn(),
  messageContainsMention: vi.fn(),
  getMessageType: vi.fn(),
  slackMessageToInbox: vi.fn(),
}));

vi.mock("./store/messages.js", () => ({
  appendMessages: vi.fn(() => 0),
  countMessages: vi.fn(() => ({ unread: 0, read: 0, archived: 0 })),
}));

vi.mock("./store/sync-state.js", () => ({
  loadSyncState: vi.fn(() => ({ unreadCount: 0 })),
  updateSyncState: vi.fn(),
}));

import {
  createSlackClient,
  listBotChannels,
  fetchChannelMessages,
  messageContainsMention,
  getMessageType,
  slackMessageToInbox,
} from "./api/slack.js";
import { appendMessages, countMessages } from "./store/messages.js";
import { loadSyncState, updateSyncState } from "./store/sync-state.js";

describe("runSync", () => {
  const baseConfig: SlackInboxConfig = {
    enabled: true,
    botToken: "xoxb-test-token",
    memberId: "U12345",
    accountId: "default",
    autoSyncIntervalMin: 0,
    channelAllowlist: [],
  };

  const baseContext: SyncContext = {
    config: baseConfig,
    storeDir: "/tmp/test-store",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("missing configuration", () => {
    it("returns error when no botToken", async () => {
      const ctx: SyncContext = {
        ...baseContext,
        config: { ...baseConfig, botToken: undefined },
      };

      const result = await runSync(ctx);

      expect(result).toEqual({
        success: false,
        newMessages: 0,
        totalMessages: 0,
        unreadCount: 0,
        channelsScanned: 0,
        error: "No bot token configured",
      });
      expect(createSlackClient).not.toHaveBeenCalled();
    });

    it("returns error when no memberId", async () => {
      const ctx: SyncContext = {
        ...baseContext,
        config: { ...baseConfig, memberId: undefined },
      };

      const result = await runSync(ctx);

      expect(result).toEqual({
        success: false,
        newMessages: 0,
        totalMessages: 0,
        unreadCount: 0,
        channelsScanned: 0,
        error: "No member ID configured (your Slack user ID to watch for mentions)",
      });
    });
  });

  describe("channel filtering", () => {
    it("scans all channels when allowlist is empty", async () => {
      const channels = [
        {
          id: "C1",
          name: "general",
          is_member: true,
          is_private: false,
          is_im: false,
          is_mpim: false,
        },
        {
          id: "C2",
          name: "random",
          is_member: true,
          is_private: false,
          is_im: false,
          is_mpim: false,
        },
      ];
      vi.mocked(listBotChannels).mockResolvedValue(channels);
      vi.mocked(fetchChannelMessages).mockResolvedValue([]);

      const result = await runSync(baseContext);

      expect(result.success).toBe(true);
      expect(result.channelsScanned).toBe(2);
      expect(listBotChannels).toHaveBeenCalledTimes(1);
      expect(fetchChannelMessages).toHaveBeenCalledTimes(2);
    });

    it("skips API call and uses allowlist channel IDs directly", async () => {
      vi.mocked(fetchChannelMessages).mockResolvedValue([]);

      const ctx: SyncContext = {
        ...baseContext,
        config: { ...baseConfig, channelAllowlist: ["C1", "C3"] },
      };

      const result = await runSync(ctx);

      expect(result.success).toBe(true);
      expect(result.channelsScanned).toBe(2);
      // Should NOT call listBotChannels when allowlist is configured
      expect(listBotChannels).not.toHaveBeenCalled();
      expect(fetchChannelMessages).toHaveBeenCalledTimes(2);
      // Verify the correct channels were scanned
      const calledChannelIds = vi.mocked(fetchChannelMessages).mock.calls.map((call) => call[1]);
      expect(calledChannelIds).toContain("C1");
      expect(calledChannelIds).toContain("C3");
    });

    it("normalizes channel IDs to uppercase", async () => {
      vi.mocked(fetchChannelMessages).mockResolvedValue([]);

      const ctx: SyncContext = {
        ...baseContext,
        config: { ...baseConfig, channelAllowlist: ["c1abc"] }, // lowercase
      };

      const result = await runSync(ctx);

      expect(result.channelsScanned).toBe(1);
      expect(listBotChannels).not.toHaveBeenCalled();
      // Verify ID was normalized to uppercase
      expect(fetchChannelMessages).toHaveBeenCalledWith(
        expect.anything(),
        "C1ABC",
        expect.anything(),
      );
    });

    it("ignores channel names in allowlist (only uses IDs)", async () => {
      vi.mocked(fetchChannelMessages).mockResolvedValue([]);

      const ctx: SyncContext = {
        ...baseContext,
        config: { ...baseConfig, channelAllowlist: ["general", "C3"] }, // "general" is a name, not ID
      };

      const result = await runSync(ctx);

      expect(result.success).toBe(true);
      // Only C3 should be scanned (general is not a valid ID pattern)
      expect(result.channelsScanned).toBe(1);
      expect(listBotChannels).not.toHaveBeenCalled();
      const calledChannelIds = vi.mocked(fetchChannelMessages).mock.calls.map((call) => call[1]);
      expect(calledChannelIds).toContain("C3");
      expect(calledChannelIds).not.toContain("general");
    });

    it("handles private channel IDs (G prefix)", async () => {
      vi.mocked(fetchChannelMessages).mockResolvedValue([]);

      const ctx: SyncContext = {
        ...baseContext,
        config: { ...baseConfig, channelAllowlist: ["G123ABC"] },
      };

      const result = await runSync(ctx);

      expect(result.success).toBe(true);
      expect(result.channelsScanned).toBe(1);
      expect(listBotChannels).not.toHaveBeenCalled();
      expect(fetchChannelMessages).toHaveBeenCalledWith(
        expect.anything(),
        "G123ABC",
        expect.anything(),
      );
    });

    it("returns success with warning when allowlist has no valid channel IDs", async () => {
      vi.mocked(countMessages).mockReturnValue({ unread: 5, read: 2, archived: 1 });

      const ctx: SyncContext = {
        ...baseContext,
        config: { ...baseConfig, channelAllowlist: ["nonexistent", "general"] }, // no valid IDs
      };

      const result = await runSync(ctx);

      expect(result.success).toBe(true);
      expect(result.channelsScanned).toBe(0);
      expect(result.error).toContain("Bot is not a member of any channels");
      expect(listBotChannels).not.toHaveBeenCalled();
    });
  });

  describe("message processing", () => {
    it("filters messages by member mention", async () => {
      const channels = [
        {
          id: "C1",
          name: "general",
          is_member: true,
          is_private: false,
          is_im: false,
          is_mpim: false,
        },
      ];
      const messages = [
        { ts: "1.0", user: "U999", text: "Hello <@U12345>!", type: "message", channel: "C1" },
        { ts: "2.0", user: "U888", text: "No mention here", type: "message", channel: "C1" },
      ];

      vi.mocked(listBotChannels).mockResolvedValue(channels);
      vi.mocked(fetchChannelMessages).mockResolvedValue(messages);
      vi.mocked(messageContainsMention).mockImplementation((text) => text.includes("<@U12345>"));
      vi.mocked(getMessageType).mockReturnValue("mention");
      vi.mocked(slackMessageToInbox).mockImplementation((msg, ch, type) => ({
        id: `${ch.id}:${msg.ts}`,
        ts: msg.ts,
        channelId: ch.id,
        channelName: ch.name,
        type,
        senderId: msg.user ?? "unknown",
        text: msg.text,
        status: "unread" as const,
        receivedAt: Date.now(),
      }));
      vi.mocked(appendMessages).mockReturnValue(1);
      vi.mocked(countMessages).mockReturnValue({ unread: 1, read: 0, archived: 0 });

      const result = await runSync(baseContext);

      expect(result.success).toBe(true);
      expect(messageContainsMention).toHaveBeenCalledTimes(2);
      expect(slackMessageToInbox).toHaveBeenCalledTimes(1);
      expect(appendMessages).toHaveBeenCalledWith("/tmp/test-store", expect.any(Array));
    });

    it("handles channel fetch errors gracefully", async () => {
      const channels = [
        {
          id: "C1",
          name: "general",
          is_member: true,
          is_private: false,
          is_im: false,
          is_mpim: false,
        },
        {
          id: "C2",
          name: "broken",
          is_member: true,
          is_private: false,
          is_im: false,
          is_mpim: false,
        },
      ];

      vi.mocked(listBotChannels).mockResolvedValue(channels);
      vi.mocked(fetchChannelMessages)
        .mockResolvedValueOnce([]) // C1 succeeds
        .mockRejectedValueOnce(new Error("API error")); // C2 fails

      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const ctx: SyncContext = {
        ...baseContext,
        logger,
      };

      const result = await runSync(ctx);

      expect(result.success).toBe(true);
      expect(result.channelsScanned).toBe(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch channel broken"),
      );
    });

    it("updates sync state after successful sync", async () => {
      const channels = [
        {
          id: "C1",
          name: "general",
          is_member: true,
          is_private: false,
          is_im: false,
          is_mpim: false,
        },
      ];

      vi.mocked(listBotChannels).mockResolvedValue(channels);
      vi.mocked(fetchChannelMessages).mockResolvedValue([]);
      vi.mocked(countMessages).mockReturnValue({ unread: 3, read: 1, archived: 0 });

      await runSync(baseContext);

      expect(updateSyncState).toHaveBeenCalledWith("/tmp/test-store", {
        lastSyncTs: expect.any(Number),
        unreadCount: 3,
        userId: "U12345",
      });
    });
  });

  describe("deduplication", () => {
    it("deduplicates messages by ID before storing", async () => {
      const channels = [
        {
          id: "C1",
          name: "general",
          is_member: true,
          is_private: false,
          is_im: false,
          is_mpim: false,
        },
      ];
      // Same message ID appears twice
      const messages = [
        { ts: "1.0", user: "U999", text: "Hello <@U12345>!", type: "message", channel: "C1" },
        { ts: "1.0", user: "U999", text: "Hello <@U12345>!", type: "message", channel: "C1" },
      ];

      vi.mocked(listBotChannels).mockResolvedValue(channels);
      vi.mocked(fetchChannelMessages).mockResolvedValue(messages);
      vi.mocked(messageContainsMention).mockReturnValue(true);
      vi.mocked(getMessageType).mockReturnValue("mention");
      vi.mocked(slackMessageToInbox).mockImplementation((msg, ch, type) => ({
        id: `${ch.id}:${msg.ts}`,
        ts: msg.ts,
        channelId: ch.id,
        channelName: ch.name,
        type,
        senderId: msg.user ?? "unknown",
        text: msg.text,
        status: "unread" as const,
        receivedAt: Date.now(),
      }));

      await runSync(baseContext);

      // appendMessages should receive deduplicated array with only 1 message
      const appendCall = vi.mocked(appendMessages).mock.calls[0];
      expect(appendCall[1]).toHaveLength(1);
    });
  });
});
