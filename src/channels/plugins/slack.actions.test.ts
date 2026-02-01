import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { createSlackActions } from "./slack.actions.js";

const handleSlackAction = vi.fn(async () => ({ details: { ok: true } }));

vi.mock("../../agents/tools/slack-actions.js", () => ({
  handleSlackAction: (...args: unknown[]) => handleSlackAction(...args),
}));

describe("slack actions adapter", () => {
  beforeEach(() => {
    handleSlackAction.mockClear();
  });

  it("forwards threadId for read", async () => {
    const cfg = { channels: { slack: { botToken: "tok" } } } as OpenClawConfig;
    const actions = createSlackActions("slack");

    await actions.handleAction?.({
      channel: "slack",
      action: "read",
      cfg,
      params: {
        channelId: "C1",
        threadId: "171234.567",
      },
    });

    const [params] = handleSlackAction.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      action: "readMessages",
      channelId: "C1",
      threadId: "171234.567",
    });
  });

  it("lists thread-reply in actions when messages enabled", () => {
    const cfg = { channels: { slack: { botToken: "tok" } } } as OpenClawConfig;
    const actions = createSlackActions("slack");
    const listed = actions.listActions?.({ cfg }) ?? [];
    expect(listed).toContain("thread-reply");
  });

  it("does not list thread-reply when messages disabled", () => {
    const cfg = {
      channels: { slack: { botToken: "tok", actions: { messages: false } } },
    } as OpenClawConfig;
    const actions = createSlackActions("slack");
    const listed = actions.listActions?.({ cfg }) ?? [];
    expect(listed).not.toContain("thread-reply");
  });

  it("handles thread-reply action", async () => {
    const cfg = { channels: { slack: { botToken: "tok" } } } as OpenClawConfig;
    const actions = createSlackActions("slack");

    await actions.handleAction?.({
      channel: "slack",
      action: "thread-reply",
      cfg,
      params: {
        channelId: "C123",
        threadId: "1712345.678",
        message: "Thread reply content",
      },
    });

    const [params] = handleSlackAction.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      action: "sendMessage",
      to: "channel:C123",
      content: "Thread reply content",
      threadTs: "1712345.678",
    });
  });

  it("thread-reply throws without thread identifier", async () => {
    const cfg = { channels: { slack: { botToken: "tok" } } } as OpenClawConfig;
    const actions = createSlackActions("slack");

    await expect(
      actions.handleAction?.({
        channel: "slack",
        action: "thread-reply",
        cfg,
        params: {
          channelId: "C123",
          message: "Missing thread",
        },
      }),
    ).rejects.toThrow(/thread-reply requires/);
  });
});
