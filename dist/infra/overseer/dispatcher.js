import crypto from "node:crypto";
import { callGateway } from "../../gateway/call.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
import { buildSubagentSystemPrompt } from "../../agents/subagent-announce.js";
import { registerSubagentRun } from "../../agents/subagent-registry.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { AGENT_LANE_SUBAGENT } from "../../agents/lanes.js";
const log = createSubsystemLogger("gateway/overseer.dispatcher");
async function dispatchToSession(params) {
    const response = (await callGateway({
        method: "agent",
        params: {
            message: params.message,
            sessionKey: params.sessionKey,
            idempotencyKey: params.dispatchId,
            deliver: false,
            lane: AGENT_LANE_SUBAGENT,
        },
        timeoutMs: 10_000,
    }));
    const runId = typeof response?.runId === "string" ? response.runId : undefined;
    return runId;
}
async function dispatchSpawn(params) {
    const targetAgentId = normalizeAgentId(params.agentId);
    const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
    const requesterSessionKey = params.requesterSessionKey ?? "agent:main";
    const requesterOrigin = normalizeDeliveryContext(params.requesterOrigin);
    const requesterDisplayKey = requesterSessionKey;
    const systemPrompt = buildSubagentSystemPrompt({
        requesterSessionKey,
        requesterOrigin,
        childSessionKey,
        label: params.label,
        task: params.message,
    });
    const response = (await callGateway({
        method: "agent",
        params: {
            message: params.message,
            sessionKey: childSessionKey,
            idempotencyKey: params.dispatchId,
            deliver: false,
            lane: AGENT_LANE_SUBAGENT,
            extraSystemPrompt: systemPrompt,
            label: params.label,
            spawnedBy: requesterSessionKey,
        },
        timeoutMs: 10_000,
    }));
    const runId = typeof response?.runId === "string" ? response.runId : params.dispatchId;
    registerSubagentRun({
        runId,
        childSessionKey,
        requesterSessionKey,
        requesterOrigin,
        requesterDisplayKey,
        task: params.message,
        cleanup: params.cleanup ?? "keep",
        label: params.label,
    });
    return runId;
}
async function dispatchEscalation(params) {
    const ctx = normalizeDeliveryContext(params.deliveryContext);
    const to = ctx?.to;
    const channel = ctx?.channel;
    if (!to || !channel) {
        throw new Error("missing delivery context for escalation");
    }
    await callGateway({
        method: "send",
        params: {
            to,
            channel,
            accountId: ctx.accountId,
            threadId: ctx.threadId,
            message: params.message,
            idempotencyKey: params.dispatchId,
            sessionKey: params.sessionKey,
        },
        timeoutMs: 10_000,
    });
}
export async function executeOverseerActions(params) {
    const outcomes = [];
    for (const action of params.actions) {
        try {
            if (action.type === "nudge" || action.type === "resend") {
                const runId = await dispatchToSession({
                    sessionKey: action.sessionKey,
                    message: action.message,
                    dispatchId: action.dispatchId,
                });
                outcomes.push({
                    assignmentId: action.assignmentId,
                    dispatchId: action.dispatchId,
                    ok: true,
                    status: "ok",
                    runId,
                });
                continue;
            }
            if (action.type === "spawn") {
                const runId = await dispatchSpawn({
                    message: action.message,
                    agentId: action.agentId,
                    dispatchId: action.dispatchId,
                    requesterSessionKey: action.requesterSessionKey,
                    requesterOrigin: action.requesterOrigin,
                    label: action.label,
                    cleanup: action.cleanup,
                });
                outcomes.push({
                    assignmentId: action.assignmentId,
                    dispatchId: action.dispatchId,
                    ok: true,
                    status: "ok",
                    runId,
                });
                continue;
            }
            if (action.type === "escalate") {
                await dispatchEscalation({
                    deliveryContext: action.deliveryContext,
                    message: action.message,
                    dispatchId: action.dispatchId,
                    sessionKey: action.sessionKey,
                });
                outcomes.push({
                    assignmentId: action.assignmentId,
                    dispatchId: action.dispatchId,
                    ok: true,
                    status: "ok",
                });
                continue;
            }
        }
        catch (err) {
            log.error("overseer dispatch failed", {
                assignmentId: action.assignmentId,
                type: action.type,
                error: String(err),
            });
            outcomes.push({
                assignmentId: action.assignmentId,
                dispatchId: action.dispatchId,
                ok: false,
                status: "error",
                notes: String(err),
            });
        }
    }
    return outcomes;
}
