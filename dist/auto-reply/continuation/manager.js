import { onCompletion } from "./registry.js";
const managedSessions = new Map();
const signalDetectors = [];
// ─── Built-in Signal Detectors ──────────────────────────────────────────────
/**
 * Detects when a tool error occurred that might need recovery.
 */
const toolErrorDetector = (event) => {
    if (event.level !== "turn")
        return null;
    if (!event.lastToolError)
        return null;
    return {
        level: "turn",
        reason: `Tool error: ${event.lastToolError.toolName}`,
        confidence: 0.6,
        suggestedPrompt: `The previous tool "${event.lastToolError.toolName}" encountered an error. Please review the error and try an alternative approach.`,
    };
};
/**
 * Detects when the agent completed without sending any messages.
 */
const silentCompletionDetector = (event) => {
    if (event.level !== "turn")
        return null;
    if (event.assistantTexts.length > 0)
        return null;
    if (event.didSendViaMessagingTool)
        return null;
    return {
        level: "turn",
        reason: "Silent completion - no messages sent",
        confidence: 0.3,
        suggestedPrompt: "Please provide a status update on your progress.",
    };
};
/**
 * Detects when a queue has been fully processed.
 */
const queueDrainedDetector = (event) => {
    if (event.level !== "queue")
        return null;
    if (!event.queueEmpty)
        return null;
    // Only signal if there's an active goal (to be implemented via session state)
    return null;
};
// Register built-in detectors
signalDetectors.push(toolErrorDetector, silentCompletionDetector, queueDrainedDetector);
// ─── Manager API ────────────────────────────────────────────────────────────
/**
 * Register a custom signal detector.
 */
export function registerSignalDetector(detector) {
    signalDetectors.push(detector);
    return () => {
        const idx = signalDetectors.indexOf(detector);
        if (idx >= 0)
            signalDetectors.splice(idx, 1);
    };
}
/**
 * Set an active goal for a session.
 */
export function setSessionGoal(sessionKey, goal) {
    const session = managedSessions.get(sessionKey) ?? {
        sessionKey,
        turnCount: 0,
        lastTurnAt: Date.now(),
        signals: [],
    };
    session.goal = goal;
    managedSessions.set(sessionKey, session);
}
/**
 * Clear the active goal for a session.
 */
export function clearSessionGoal(sessionKey) {
    const session = managedSessions.get(sessionKey);
    if (session) {
        session.goal = undefined;
        if (session.turnCount === 0) {
            managedSessions.delete(sessionKey);
        }
    }
}
/**
 * Get the current state of a managed session.
 */
export function getManagedSession(sessionKey) {
    return managedSessions.get(sessionKey);
}
/**
 * Get recent signals for a session.
 */
export function getSessionSignals(sessionKey, limit = 10) {
    return managedSessions.get(sessionKey)?.signals.slice(-limit) ?? [];
}
/**
 * Clear manager state (for testing).
 */
export function clearManagerState() {
    managedSessions.clear();
}
/**
 * Clear all signal detectors and restore only built-ins (for testing).
 */
export function resetSignalDetectors() {
    signalDetectors.length = 0;
    signalDetectors.push(toolErrorDetector, silentCompletionDetector, queueDrainedDetector);
}
// ─── Core Handler ───────────────────────────────────────────────────────────
/**
 * Process a completion event and determine if continuation is needed.
 * This is the main handler registered with the completion registry.
 */
function handleCompletion(event) {
    const sessionKey = resolveSessionKey(event);
    if (!sessionKey)
        return;
    // Update session state
    const session = managedSessions.get(sessionKey) ?? {
        sessionKey,
        turnCount: 0,
        lastTurnAt: Date.now(),
        signals: [],
    };
    if (event.level === "turn") {
        session.turnCount++;
        session.lastTurnAt = event.timestamp;
    }
    managedSessions.set(sessionKey, session);
    // Check for turn limit on active goal (after incrementing and saving)
    if (event.level === "turn") {
        if (session.goal?.maxTurns && session.turnCount >= session.goal.maxTurns) {
            return {
                action: "none",
                reason: `Max turns (${session.goal.maxTurns}) reached`,
                goalUpdate: { status: "paused" },
            };
        }
    }
    // Run signal detectors
    const signals = [];
    for (const detector of signalDetectors) {
        const signal = detector(event);
        if (signal) {
            signals.push(signal);
            session.signals.push(signal);
        }
    }
    // Trim signal history
    if (session.signals.length > 100) {
        session.signals = session.signals.slice(-50);
    }
    // Determine if we should continue based on signals
    if (signals.length === 0)
        return;
    // Find highest confidence signal that suggests continuation
    const bestSignal = signals.reduce((best, s) => (s.confidence > best.confidence ? s : best));
    // Only auto-continue if there's an active goal and high confidence
    if (session.goal?.status === "active" && bestSignal.confidence >= 0.7) {
        return {
            action: "enqueue",
            nextPrompt: bestSignal.suggestedPrompt,
            reason: bestSignal.reason,
            goalUpdate: { turnsUsed: session.turnCount },
        };
    }
    return;
}
/**
 * Resolve session key from a completion event.
 */
function resolveSessionKey(event) {
    switch (event.level) {
        case "turn":
            return event.sessionKey;
        case "run":
            return event.sessionKey;
        case "queue":
            return event.sessionKey;
    }
}
// ─── Manager Initialization ─────────────────────────────────────────────────
let initialized = false;
let unsubscribe = null;
/**
 * Initialize the continuation manager. Safe to call multiple times.
 * Returns a function to stop the manager.
 */
export function initContinuationManager() {
    if (initialized) {
        return () => stopContinuationManager();
    }
    unsubscribe = onCompletion(handleCompletion, {
        id: "continuation-manager",
        priority: 50, // Run before other handlers
    });
    initialized = true;
    return () => stopContinuationManager();
}
/**
 * Stop the continuation manager.
 */
export function stopContinuationManager() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    initialized = false;
}
/**
 * Check if the manager is initialized.
 */
export function isManagerInitialized() {
    return initialized;
}
