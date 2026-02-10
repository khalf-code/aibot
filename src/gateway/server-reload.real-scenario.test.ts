/**
 * REAL scenario test - simulates actual message handling with config changes.
 * This test MUST fail if "imsg rpc not running" would occur in production.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("real scenario: config change during message processing", () => {
  let replyErrors: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    replyErrors = [];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Wait for any pending microtasks (from markComplete()) to complete
    await Promise.resolve();
    const { clearAllDispatchers } = await import("../auto-reply/reply/dispatcher-registry.js");
    clearAllDispatchers();
  });

  it("should NOT restart gateway before replies are sent", async () => {
    const { createReplyDispatcher } = await import("../auto-reply/reply/reply-dispatcher.js");
    const { getTotalPendingReplies } = await import("../auto-reply/reply/dispatcher-registry.js");

    // Simulate the REAL flow that happens in production
    const events: Array<{ time: number; event: string }> = [];
    const startTime = Date.now();
    const log = (event: string) => events.push({ time: Date.now() - startTime, event });

    // Track if deliver was called (simulates RPC connection status)
    let rpcConnected = true;
    const deliveredReplies: string[] = [];

    // Step 1: Message received — create dispatcher (registers with pending=1)
    log("message-received");
    const dispatcher = createReplyDispatcher({
      deliver: async (payload) => {
        log(`deliver-called: rpc=${rpcConnected}`);
        if (!rpcConnected) {
          const error = "Error: imsg rpc not running";
          replyErrors.push(error);
          log(`deliver-failed: ${error}`);
          throw new Error(error);
        }
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        deliveredReplies.push(payload.text ?? "");
        log(`deliver-success: ${payload.text}`);
      },
      onError: (err) => {
        log(`onError: ${String(err)}`);
      },
    });

    log(`initial-state: pending=${getTotalPendingReplies()}`);

    // Step 2: Simulate command processing (async, like real agent)
    const processCommand = async () => {
      log("command-start");
      // Simulate agent thinking time
      await new Promise((resolve) => setTimeout(resolve, 500));
      log("command-generating-reply");
      // Enqueue reply
      dispatcher.sendFinalReply({ text: "Configuration updated!" });
      log(`command-reply-enqueued: pending=${getTotalPendingReplies()}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      log("command-finish");
    };

    // Start command processing (don't await yet - it runs in background)
    const commandPromise = processCommand();

    // Step 3: Simulate config change DURING command processing
    await new Promise((resolve) => setTimeout(resolve, 200));
    log(`config-change-detected: pending=${getTotalPendingReplies()}`);

    // Step 4: Simulate restart deferral check
    const checkRestart = () => {
      const pending = getTotalPendingReplies();
      log(`restart-check: pending=${pending}`);
      return pending;
    };

    // THIS IS THE CRITICAL CHECK - if pending becomes 0 before replies sent, restart proceeds
    let totalActive = checkRestart();
    expect(totalActive).toBeGreaterThan(0); // MUST be > 0 to defer restart

    // Step 5: Simulate periodic restart checks (500ms intervals)
    const checkInterval = 500;
    const maxChecks = 5;
    for (let i = 0; i < maxChecks; i++) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      totalActive = checkRestart();

      // If total becomes 0, gateway would restart here
      if (totalActive === 0) {
        log("RESTART-TRIGGERED");
        rpcConnected = false; // Simulate RPC dying
        break;
      }
    }

    // Step 6: Wait for command to finish
    await commandPromise;

    // Step 7: Mark complete and wait for idle
    dispatcher.markComplete();
    log(`after-markComplete: pending=${getTotalPendingReplies()}`);

    await dispatcher.waitForIdle();
    log(`after-waitForIdle: pending=${getTotalPendingReplies()}`);

    // ASSERTIONS
    console.log("\n=== Event Timeline ===");
    events.forEach(({ time, event }) => {
      console.log(`T+${time.toString().padStart(4, " ")}ms: ${event}`);
    });
    console.log("===================\n");

    // CRITICAL: No reply errors should occur
    expect(replyErrors).toEqual([]);
    expect(deliveredReplies).toEqual(["Configuration updated!"]);
  });

  it("should keep pending > 0 until reply is actually enqueued", async () => {
    const { createReplyDispatcher } = await import("../auto-reply/reply/reply-dispatcher.js");
    const { getTotalPendingReplies } = await import("../auto-reply/reply/dispatcher-registry.js");

    const dispatcher = createReplyDispatcher({
      deliver: async (_payload) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
    });

    // Initially: pending=1 (reservation)
    expect(getTotalPendingReplies()).toBe(1);

    // Simulate command processing delay BEFORE reply is enqueued
    await new Promise((resolve) => setTimeout(resolve, 100));

    // During this delay, pending should STILL be 1 (reservation active)
    expect(getTotalPendingReplies()).toBe(1);

    // Now enqueue reply
    dispatcher.sendFinalReply({ text: "Reply" });

    // Now pending should be 2 (reservation + reply)
    expect(getTotalPendingReplies()).toBe(2);

    // Mark complete
    dispatcher.markComplete();

    // After markComplete, pending should still be > 0 if reply hasn't sent yet
    const pendingAfterMarkComplete = getTotalPendingReplies();
    expect(pendingAfterMarkComplete).toBeGreaterThan(0);

    // Wait for reply to send
    await dispatcher.waitForIdle();

    // Now pending should be 0
    expect(getTotalPendingReplies()).toBe(0);
  });
});
