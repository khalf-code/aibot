import { updateSessionStoreEntry } from "../../config/sessions.js";
export async function persistGoalState(params) {
    await updateSessionStoreEntry({
        storePath: params.storePath,
        sessionKey: params.sessionKey,
        update: async (entry) => ({
            ...entry,
            activeGoal: params.goal,
        }),
    });
}
export async function clearGoalState(params) {
    await updateSessionStoreEntry({
        storePath: params.storePath,
        sessionKey: params.sessionKey,
        update: async (entry) => {
            const { activeGoal: _, ...rest } = entry;
            return rest;
        },
    });
}
