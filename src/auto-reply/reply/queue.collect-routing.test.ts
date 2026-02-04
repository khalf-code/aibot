import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { enqueueFollowupRun, scheduleFollowupDrain } from "./queue.js";

function createRun(params: {
  prompt: string;
  messageId?: string;
  originatingChannel?: FollowupRun["originatingChannel"];
  originatingTo?: string;
  originatingAccountId?: string;
  originatingThreadId?: string | number;
}): FollowupRun {
  return {
    prompt: params.prompt,
    messageId: params.messageId,
    enqueuedAt: Date.now(),
    originatingChannel: params.originatingChannel,
    originatingTo: params.originatingTo,
    originatingAccountId: params.originatingAccountId,
    originatingThreadId: params.originatingThreadId,
    run: {
      agentId: "agent",
      agentDir: "/tmp",
      sessionId: "sess",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp",
      config: {} as OpenClawConfig,
      provider: "openai",
      model: "gpt-test",
      timeoutMs: 10_000,
      blockReplyBreak: "text_end",
    },
  };
}

describe("followup queue deduplication", () => {
  it("deduplicates messages with same Discord message_id", async () => {
    const key = `test-dedup-message-id-${Date.now()}`;
    const calls: FollowupRun[] = [];
    const runFollowup = async (run: FollowupRun) => {
      calls.push(run);
    };
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    // First enqueue should succeed
    const first = enqueueFollowupRun(
      key,
      createRun({
        prompt: "[Discord Guild #test channel id:123] Hello",
        messageId: "m1",
        originatingChannel: "discord",
        originatingTo: "channel:123",
      }),
      settings,
    );
    expect(first).toBe(true);

    // Second enqueue with same message id should be deduplicated
    const second = enqueueFollowupRun(
      key,
      createRun({
        prompt: "[Discord Guild #test channel id:123] Hello (dupe)",
        messageId: "m1",
        originatingChannel: "discord",
        originatingTo: "channel:123",
      }),
      settings,
    );
    expect(second).toBe(false);

    // Third enqueue with different message id should succeed
    const third = enqueueFollowupRun(
      key,
      createRun({
        prompt: "[Discord Guild #test channel id:123] World",
        messageId: "m2",
        originatingChannel: "discord",
        originatingTo: "channel:123",
      }),
      settings,
    );
    expect(third).toBe(true);

    scheduleFollowupDrain(key, runFollowup);
    await expect.poll(() => calls.length).toBe(1);
    // Should collect both unique messages
    expect(calls[0]?.prompt).toContain("[Queued messages while agent was busy]");
  });

  it("deduplicates exact prompt when routing matches and no message id", async () => {
    const key = `test-dedup-whatsapp-${Date.now()}`;
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    // First enqueue should succeed
    const first = enqueueFollowupRun(
      key,
      createRun({
        prompt: "Hello world",
        originatingChannel: "whatsapp",
        originatingTo: "+1234567890",
      }),
      settings,
    );
    expect(first).toBe(true);

    // Second enqueue with same prompt should be allowed (default dedupe: message id only)
    const second = enqueueFollowupRun(
      key,
      createRun({
        prompt: "Hello world",
        originatingChannel: "whatsapp",
        originatingTo: "+1234567890",
      }),
      settings,
    );
    expect(second).toBe(true);

    // Third enqueue with different prompt should succeed
    const third = enqueueFollowupRun(
      key,
      createRun({
        prompt: "Hello world 2",
        originatingChannel: "whatsapp",
        originatingTo: "+1234567890",
      }),
      settings,
    );
    expect(third).toBe(true);
  });

  it("does not deduplicate across different providers without message id", async () => {
    const key = `test-dedup-cross-provider-${Date.now()}`;
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    const first = enqueueFollowupRun(
      key,
      createRun({
        prompt: "Same text",
        originatingChannel: "whatsapp",
        originatingTo: "+1234567890",
      }),
      settings,
    );
    expect(first).toBe(true);

    const second = enqueueFollowupRun(
      key,
      createRun({
        prompt: "Same text",
        originatingChannel: "discord",
        originatingTo: "channel:123",
      }),
      settings,
    );
    expect(second).toBe(true);
  });

  it("can opt-in to prompt-based dedupe when message id is absent", async () => {
    const key = `test-dedup-prompt-mode-${Date.now()}`;
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    const first = enqueueFollowupRun(
      key,
      createRun({
        prompt: "Hello world",
        originatingChannel: "whatsapp",
        originatingTo: "+1234567890",
      }),
      settings,
      "prompt",
    );
    expect(first).toBe(true);

    const second = enqueueFollowupRun(
      key,
      createRun({
        prompt: "Hello world",
        originatingChannel: "whatsapp",
        originatingTo: "+1234567890",
      }),
      settings,
      "prompt",
    );
    expect(second).toBe(false);
  });
});

describe("followup queue collect routing", () => {
  it("does not collect when destinations differ", async () => {
    const key = `test-collect-diff-to-${Date.now()}`;
    const calls: FollowupRun[] = [];
    const runFollowup = async (run: FollowupRun) => {
      calls.push(run);
    };
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    enqueueFollowupRun(
      key,
      createRun({
        prompt: "one",
        originatingChannel: "slack",
        originatingTo: "channel:A",
      }),
      settings,
    );
    enqueueFollowupRun(
      key,
      createRun({
        prompt: "two",
        originatingChannel: "slack",
        originatingTo: "channel:B",
      }),
      settings,
    );

    scheduleFollowupDrain(key, runFollowup);
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[0]?.prompt).toBe("one");
    expect(calls[1]?.prompt).toBe("two");
  });

  it("collects when channel+destination match", async () => {
    const key = `test-collect-same-to-${Date.now()}`;
    const calls: FollowupRun[] = [];
    const runFollowup = async (run: FollowupRun) => {
      calls.push(run);
    };
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    enqueueFollowupRun(
      key,
      createRun({
        prompt: "one",
        originatingChannel: "slack",
        originatingTo: "channel:A",
      }),
      settings,
    );
    enqueueFollowupRun(
      key,
      createRun({
        prompt: "two",
        originatingChannel: "slack",
        originatingTo: "channel:A",
      }),
      settings,
    );

    scheduleFollowupDrain(key, runFollowup);
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]?.prompt).toContain("[Queued messages while agent was busy]");
    expect(calls[0]?.originatingChannel).toBe("slack");
    expect(calls[0]?.originatingTo).toBe("channel:A");
  });

  it("preserves string threadId (Slack thread_ts) when collecting same-thread messages", async () => {
    const key = `test-collect-slack-thread-${Date.now()}`;
    const calls: FollowupRun[] = [];
    const runFollowup = async (run: FollowupRun) => {
      calls.push(run);
    };
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    // Slack thread_ts is a string like "1770190377.959229"
    const slackThreadTs = "1770190377.959229";

    enqueueFollowupRun(
      key,
      createRun({
        prompt: "first message in thread",
        originatingChannel: "slack",
        originatingTo: "channel:C1234",
        originatingThreadId: slackThreadTs,
      }),
      settings,
    );
    enqueueFollowupRun(
      key,
      createRun({
        prompt: "second message in thread",
        originatingChannel: "slack",
        originatingTo: "channel:C1234",
        originatingThreadId: slackThreadTs,
      }),
      settings,
    );

    scheduleFollowupDrain(key, runFollowup);
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]?.prompt).toContain("[Queued messages while agent was busy]");
    expect(calls[0]?.originatingChannel).toBe("slack");
    expect(calls[0]?.originatingTo).toBe("channel:C1234");
    // This is the key assertion: string threadId must be preserved
    expect(calls[0]?.originatingThreadId).toBe(slackThreadTs);
  });

  it("does not collect messages from different threads (string threadId)", async () => {
    const key = `test-collect-diff-thread-${Date.now()}`;
    const calls: FollowupRun[] = [];
    const runFollowup = async (run: FollowupRun) => {
      calls.push(run);
    };
    const settings: QueueSettings = {
      mode: "collect",
      debounceMs: 0,
      cap: 50,
      dropPolicy: "summarize",
    };

    enqueueFollowupRun(
      key,
      createRun({
        prompt: "thread A message",
        originatingChannel: "slack",
        originatingTo: "channel:C1234",
        originatingThreadId: "1770190377.111111",
      }),
      settings,
    );
    enqueueFollowupRun(
      key,
      createRun({
        prompt: "thread B message",
        originatingChannel: "slack",
        originatingTo: "channel:C1234",
        originatingThreadId: "1770190377.222222",
      }),
      settings,
    );

    scheduleFollowupDrain(key, runFollowup);
    await expect.poll(() => calls.length).toBe(2);
    // Different threads should NOT be collected together
    expect(calls[0]?.prompt).toBe("thread A message");
    expect(calls[1]?.prompt).toBe("thread B message");
  });
});
