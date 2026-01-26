/**
 * Bridge between the Continuation System and Overseer.
 *
 * This module subscribes to continuation completion events and translates them
 * into Overseer state updates, creating a feedback loop for long-horizon task management.
 */
import path from "node:path";
import { onCompletion, } from "../../auto-reply/continuation/index.js";
import { updateOverseerStore } from "./store.js";
import { appendOverseerEvent } from "./events.js";
import { requestOverseerNow } from "./wake.js";
import { applyStructuredUpdate } from "./runner.js";
// ─── Assignment Lookup ──────────────────────────────────────────────────────
function findAssignmentBySessionKey(store, sessionKey) {
    return Object.values(store.assignments).find((a) => a.sessionKey === sessionKey && a.status !== "done" && a.status !== "cancelled");
}
function findAssignmentByRunId(store, runId) {
    return Object.values(store.assignments).find((a) => a.runId === runId && a.status !== "done" && a.status !== "cancelled");
}
// ─── Event Processing ───────────────────────────────────────────────────────
async function processTurnCompletion(event, config) {
    const { storePath, hooks } = config;
    await updateOverseerStore(async (store) => {
        const assignment = (event.sessionKey && findAssignmentBySessionKey(store, event.sessionKey)) ||
            findAssignmentByRunId(store, event.runId);
        if (!assignment)
            return { store, result: null };
        const now = Date.now();
        // Detect issues
        if (event.lastToolError) {
            hooks?.onTurnIssue?.({ event, assignment, issue: "tool_error" });
            appendOverseerEvent(store, {
                ts: now,
                type: "continuation.turn.tool_error",
                assignmentId: assignment.assignmentId,
                goalId: assignment.goalId,
                data: {
                    toolName: event.lastToolError.toolName,
                    error: event.lastToolError.error,
                    runId: event.runId,
                },
            });
            // Increment retry count on tool errors
            assignment.retryCount = (assignment.retryCount ?? 0) + 1;
            assignment.lastRetryAt = now;
        }
        if (!event.didSendViaMessagingTool && event.assistantTexts.length === 0) {
            hooks?.onTurnIssue?.({ event, assignment, issue: "silent_completion" });
            appendOverseerEvent(store, {
                ts: now,
                type: "continuation.turn.silent",
                assignmentId: assignment.assignmentId,
                goalId: assignment.goalId,
                data: { runId: event.runId },
            });
        }
        // Always update activity timestamp on turn completion
        assignment.lastObservedActivityAt = now;
        assignment.updatedAt = now;
        // If assignment was stalled, mark it active again
        if (assignment.status === "stalled") {
            assignment.status = "active";
            hooks?.onAssignmentActivity?.({ assignment, source: "turn" });
        }
        // Apply structured update immediately if present (don't wait for poll)
        if (event.structuredUpdate) {
            applyStructuredUpdate({
                store,
                assignment,
                update: event.structuredUpdate,
                now,
            });
            appendOverseerEvent(store, {
                ts: now,
                type: "continuation.turn.structured_update",
                assignmentId: assignment.assignmentId,
                goalId: assignment.goalId,
                workNodeId: event.structuredUpdate.workNodeId,
                data: {
                    status: event.structuredUpdate.status,
                    summary: event.structuredUpdate.summary,
                    runId: event.runId,
                },
            });
        }
        return { store, result: null };
    }, { overseer: { storage: { dir: path.dirname(storePath) } } });
}
async function processRunCompletion(event, config) {
    const { storePath, hooks, autoTriggerTick } = config;
    await updateOverseerStore(async (store) => {
        const assignment = findAssignmentBySessionKey(store, event.sessionKey) ||
            findAssignmentByRunId(store, event.runId);
        if (!assignment)
            return { store, result: null };
        const now = Date.now();
        // Update assignment with run info
        assignment.runId = event.runId;
        assignment.lastObservedActivityAt = now;
        assignment.updatedAt = now;
        // Mark active if was stalled/dispatched
        if (assignment.status === "stalled" || assignment.status === "dispatched") {
            assignment.status = "active";
            hooks?.onAssignmentActivity?.({ assignment, source: "run" });
        }
        appendOverseerEvent(store, {
            ts: now,
            type: "continuation.run.completed",
            assignmentId: assignment.assignmentId,
            goalId: assignment.goalId,
            data: {
                runId: event.runId,
                model: event.model,
                provider: event.provider,
                autoCompactionCompleted: event.autoCompactionCompleted,
                payloadCount: event.payloads.length,
            },
        });
        return { store, result: null };
    }, { overseer: { storage: { dir: path.dirname(storePath) } } });
    // Trigger overseer tick to process any state changes
    if (autoTriggerTick) {
        requestOverseerNow({ reason: "continuation-run-complete" });
    }
}
async function processQueueCompletion(event, config) {
    const { storePath, hooks, autoTriggerTick } = config;
    if (!event.sessionKey)
        return;
    await updateOverseerStore(async (store) => {
        const assignment = findAssignmentBySessionKey(store, event.sessionKey);
        if (!assignment)
            return { store, result: null };
        const now = Date.now();
        appendOverseerEvent(store, {
            ts: now,
            type: "continuation.queue.drained",
            assignmentId: assignment.assignmentId,
            goalId: assignment.goalId,
            data: {
                queueKey: event.queueKey,
                itemsProcessed: event.itemsProcessed,
                queueEmpty: event.queueEmpty,
            },
        });
        // Update activity
        assignment.lastObservedActivityAt = now;
        assignment.updatedAt = now;
        hooks?.onAssignmentActivity?.({ assignment, source: "queue" });
        return { store, result: null };
    }, { overseer: { storage: { dir: path.dirname(storePath) } } });
    // Trigger overseer tick when queue drains to check if more work needed
    if (autoTriggerTick && event.queueEmpty) {
        requestOverseerNow({ reason: "continuation-queue-drained" });
    }
}
// ─── Main Handler ───────────────────────────────────────────────────────────
function createContinuationHandler(config) {
    return async (event) => {
        try {
            switch (event.level) {
                case "turn":
                    await processTurnCompletion(event, config);
                    break;
                case "run":
                    await processRunCompletion(event, config);
                    break;
                case "queue":
                    await processQueueCompletion(event, config);
                    break;
            }
        }
        catch (err) {
            console.error(`Overseer continuation bridge error (${event.level}):`, err);
        }
        // Don't return a decision - let other handlers decide on continuation
    };
}
// ─── Bridge Lifecycle ───────────────────────────────────────────────────────
let bridgeUnsubscribe = null;
let bridgeConfig = null;
/**
 * Start the Overseer-Continuation bridge.
 * This subscribes to continuation events and updates Overseer state accordingly.
 */
export function startOverseerContinuationBridge(config) {
    if (bridgeUnsubscribe) {
        // Already running, update config
        bridgeConfig = config;
        return () => stopOverseerContinuationBridge();
    }
    bridgeConfig = config;
    bridgeUnsubscribe = onCompletion(createContinuationHandler(config), {
        id: "overseer-continuation-bridge",
        priority: 25, // Run early to update state before other handlers
    });
    return () => stopOverseerContinuationBridge();
}
/**
 * Stop the Overseer-Continuation bridge.
 */
export function stopOverseerContinuationBridge() {
    if (bridgeUnsubscribe) {
        bridgeUnsubscribe();
        bridgeUnsubscribe = null;
    }
    bridgeConfig = null;
}
/**
 * Check if the bridge is running.
 */
export function isBridgeRunning() {
    return bridgeUnsubscribe !== null;
}
/**
 * Get current bridge config.
 */
export function getBridgeConfig() {
    return bridgeConfig;
}
// ─── Manual Integration Helpers ─────────────────────────────────────────────
/**
 * Manually report a structured update from an agent to Overseer.
 * Use this when the agent provides explicit progress updates.
 */
export async function reportStructuredUpdate(params) {
    const { storePath, sessionKey, update } = params;
    await updateOverseerStore(async (store) => {
        const assignment = findAssignmentBySessionKey(store, sessionKey);
        if (!assignment)
            return { store, result: null };
        const now = Date.now();
        // Update assignment based on structured update
        if (update.status) {
            if (update.status === "done") {
                assignment.status = "done";
            }
            else if (update.status === "blocked") {
                assignment.status = "blocked";
                assignment.blockedReason = update.blockers?.join("; ");
            }
            else if (update.status === "in_progress") {
                assignment.status = "active";
            }
        }
        assignment.lastObservedActivityAt = now;
        assignment.updatedAt = now;
        appendOverseerEvent(store, {
            ts: now,
            type: "continuation.structured_update",
            assignmentId: assignment.assignmentId,
            goalId: assignment.goalId,
            workNodeId: update.workNodeId,
            data: {
                status: update.status,
                summary: update.summary,
                next: update.next,
                blockers: update.blockers,
            },
        });
        return { store, result: null };
    }, { overseer: { storage: { dir: path.dirname(storePath) } } });
}
/**
 * Mark an assignment as needing recovery based on continuation signals.
 */
export async function markAssignmentNeedsRecovery(params) {
    const { storePath, sessionKey, reason, suggestedPolicy } = params;
    await updateOverseerStore(async (store) => {
        const assignment = findAssignmentBySessionKey(store, sessionKey);
        if (!assignment)
            return { store, result: null };
        const now = Date.now();
        assignment.status = "stalled";
        assignment.blockedReason = reason;
        if (suggestedPolicy) {
            assignment.recoveryPolicy = suggestedPolicy;
        }
        assignment.updatedAt = now;
        appendOverseerEvent(store, {
            ts: now,
            type: "continuation.recovery_needed",
            assignmentId: assignment.assignmentId,
            goalId: assignment.goalId,
            data: { reason, suggestedPolicy },
        });
        return { store, result: null };
    }, { overseer: { storage: { dir: path.dirname(storePath) } } });
    // Trigger immediate tick to handle recovery
    requestOverseerNow({ reason: "continuation-recovery-needed" });
}
