/**
 * Configuration resolution for Slack Overseer integration.
 */
import { resolveSlackAccount } from "../accounts.js";
const DEFAULT_DECISION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export function resolveSlackOverseerConfig(cfg, accountId) {
    const account = resolveSlackAccount({ cfg, accountId });
    const overseerCfg = account.config.overseer;
    if (!overseerCfg?.enabled) {
        return null;
    }
    return {
        enabled: true,
        channels: {
            activity: overseerCfg.channels?.activity,
            notifications: overseerCfg.channels?.notifications,
            questions: overseerCfg.channels?.questions,
        },
        escalationMentions: overseerCfg.escalationMentions ?? [],
        decisionTimeoutMs: overseerCfg.decisionTimeoutMs ?? DEFAULT_DECISION_TIMEOUT_MS,
        includeDashboardLink: overseerCfg.includeDashboardLink ?? true,
    };
}
export function resolveDashboardUrl(cfg, params) {
    const gatewayPort = cfg.gateway?.port ?? 18789;
    const baseUrl = `http://localhost:${gatewayPort}/ui`;
    if (!params)
        return baseUrl;
    const searchParams = new URLSearchParams();
    if (params.agentId)
        searchParams.set("agentId", params.agentId);
    if (params.goalId)
        searchParams.set("goalId", params.goalId);
    if (params.assignmentId)
        searchParams.set("assignmentId", params.assignmentId);
    const query = searchParams.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
}
