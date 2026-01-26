import crypto from "node:crypto";
import { loadSessionEntry } from "../../gateway/session-utils.js";
import { readSessionMessages } from "../../gateway/session-utils.fs.js";
import { onAgentEvent } from "../agent-events.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
function extractMessageText(message) {
    if (!message || typeof message !== "object")
        return null;
    const content = message.content;
    if (typeof content === "string")
        return content.trim() || null;
    if (!Array.isArray(content))
        return null;
    const parts = [];
    for (const block of content) {
        if (!block || typeof block !== "object")
            continue;
        const type = block.type;
        if (type !== "text" && type !== "output_text" && type !== "input_text")
            continue;
        const text = block.text;
        if (typeof text === "string" && text.trim())
            parts.push(text.trim());
    }
    const joined = parts.join("\n").trim();
    return joined || null;
}
function fingerprintText(text) {
    if (!text)
        return undefined;
    const hash = crypto.createHash("sha1");
    hash.update(text, "utf8");
    return hash.digest("hex");
}
/**
 * Parse structured Overseer update from agent response text.
 * Looks for the last ```json fenced block containing { overseerUpdate: {...} }
 */
export function parseStructuredUpdate(text) {
    if (!text)
        return undefined;
    const fenceRe = /```json\s*([\s\S]*?)```/gi;
    let match = null;
    let last;
    while ((match = fenceRe.exec(text))) {
        last = match[1]?.trim();
    }
    if (!last)
        return undefined;
    try {
        const parsed = JSON.parse(last);
        if (!parsed || typeof parsed !== "object")
            return undefined;
        if (!parsed.overseerUpdate || typeof parsed.overseerUpdate !== "object")
            return undefined;
        return parsed.overseerUpdate;
    }
    catch {
        return undefined;
    }
}
/**
 * Parse structured update from multiple text chunks (e.g., assistantTexts array).
 * Checks each chunk for overseerUpdate and returns the first found.
 */
export function parseStructuredUpdateFromTexts(texts) {
    for (const text of texts) {
        const update = parseStructuredUpdate(text);
        if (update)
            return update;
    }
    return undefined;
}
export function createOverseerMonitor() {
    const runStates = new Map();
    const unsub = onAgentEvent((evt) => {
        if (!evt || evt.stream !== "lifecycle")
            return;
        const phase = evt.data?.phase;
        if (phase === "start") {
            const startedAt = typeof evt.data?.startedAt === "number" ? evt.data.startedAt : Date.now();
            runStates.set(evt.runId, {
                status: "active",
                lastEventAt: Date.now(),
                startedAt,
            });
            return;
        }
        if (phase !== "end" && phase !== "error")
            return;
        const endedAt = typeof evt.data?.endedAt === "number" ? evt.data.endedAt : Date.now();
        const state = runStates.get(evt.runId);
        runStates.set(evt.runId, {
            status: "ended",
            lastEventAt: Date.now(),
            startedAt: state?.startedAt,
            endedAt,
        });
    });
    const collectTelemetry = async ({ assignments, sampleForAssignmentIds, }) => {
        const snapshot = { ts: Date.now(), assignments: {} };
        if (assignments.length === 0)
            return snapshot;
        for (const assignment of assignments) {
            const sessionKey = assignment.sessionKey?.trim();
            const telemetry = {
                assignmentId: assignment.assignmentId,
                sessionKey,
            };
            if (sessionKey) {
                const { entry } = loadSessionEntry(sessionKey);
                if (entry?.updatedAt) {
                    telemetry.sessionUpdatedAt = entry.updatedAt;
                }
                if (entry?.sessionId)
                    telemetry.sessionId = entry.sessionId;
                telemetry.deliveryContext = normalizeDeliveryContext(entry?.deliveryContext);
                if (sampleForAssignmentIds?.has(assignment.assignmentId) && entry?.sessionId) {
                    const messages = readSessionMessages(entry.sessionId, undefined, entry.sessionFile);
                    const tail = Array.isArray(messages) ? messages.slice(-20) : [];
                    let lastText = null;
                    for (let i = tail.length - 1; i >= 0; i -= 1) {
                        const msg = tail[i];
                        const text = extractMessageText(msg);
                        if (text) {
                            lastText = text;
                            break;
                        }
                    }
                    telemetry.lastMessageFingerprint = fingerprintText(lastText);
                    telemetry.structuredUpdate = parseStructuredUpdate(lastText);
                }
            }
            if (assignment.runId) {
                const state = runStates.get(assignment.runId);
                if (state && state.status === "active") {
                    telemetry.runActive = true;
                }
            }
            snapshot.assignments[assignment.assignmentId] = telemetry;
        }
        return snapshot;
    };
    return {
        collectTelemetry,
        stop: () => {
            unsub();
            runStates.clear();
        },
    };
}
