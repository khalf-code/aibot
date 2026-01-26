import { Type } from "@sinclair/typebox";
export const OverseerStatusParamsSchema = Type.Object({
    includeGoals: Type.Optional(Type.Boolean()),
    includeAssignments: Type.Optional(Type.Boolean()),
    includeCrystallizations: Type.Optional(Type.Boolean()),
});
export const OverseerGoalSummarySchema = Type.Object({
    goalId: Type.String(),
    title: Type.String(),
    status: Type.String(),
    priority: Type.String(),
    updatedAt: Type.Number(),
    tags: Type.Array(Type.String()),
});
export const OverseerAssignmentSummarySchema = Type.Object({
    assignmentId: Type.String(),
    goalId: Type.String(),
    workNodeId: Type.String(),
    status: Type.String(),
    lastDispatchAt: Type.Optional(Type.Number()),
    lastObservedActivityAt: Type.Optional(Type.Number()),
    retryCount: Type.Optional(Type.Number()),
});
export const OverseerStatusResultSchema = Type.Object({
    ts: Type.Number(),
    goals: Type.Array(OverseerGoalSummarySchema),
    stalledAssignments: Type.Array(OverseerAssignmentSummarySchema),
});
export const OverseerGoalCreateParamsSchema = Type.Object({
    title: Type.String(),
    problemStatement: Type.String(),
    successCriteria: Type.Optional(Type.Array(Type.String())),
    constraints: Type.Optional(Type.Array(Type.String())),
    nonGoals: Type.Optional(Type.Array(Type.String())),
    priority: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    fromSession: Type.Optional(Type.String()),
    owner: Type.Optional(Type.String()),
    repoContextSnapshot: Type.Optional(Type.String()),
    generatePlan: Type.Optional(Type.Boolean()),
});
export const OverseerGoalCreateResultSchema = Type.Object({
    goalId: Type.String(),
    planGenerated: Type.Boolean(),
});
export const OverseerGoalStatusParamsSchema = Type.Object({
    goalId: Type.String(),
});
export const OverseerGoalUpdateParamsSchema = Type.Object({
    goalId: Type.String(),
    title: Type.Optional(Type.String()),
    problemStatement: Type.Optional(Type.String()),
    successCriteria: Type.Optional(Type.Array(Type.String())),
    constraints: Type.Optional(Type.Array(Type.String())),
});
const OverseerPlanNodeBaseFields = {
    id: Type.String(),
    parentId: Type.Optional(Type.String()),
    path: Type.Optional(Type.String()),
    name: Type.String(),
    objective: Type.Optional(Type.String()),
    expectedOutcome: Type.Optional(Type.String()),
    acceptanceCriteria: Type.Optional(Type.Array(Type.String())),
    definitionOfDone: Type.Optional(Type.String()),
    dependsOn: Type.Optional(Type.Array(Type.String())),
    blocks: Type.Optional(Type.Array(Type.String())),
    suggestedAgentId: Type.Optional(Type.String()),
    suggestedAgentType: Type.Optional(Type.String()),
    requiredTools: Type.Optional(Type.Array(Type.String())),
    estimatedEffort: Type.Optional(Type.String()),
    riskLevel: Type.Optional(Type.String()),
    status: Type.String(),
    blockedReason: Type.Optional(Type.String()),
    createdAt: Type.Number(),
    updatedAt: Type.Number(),
    startedAt: Type.Optional(Type.Number()),
    endedAt: Type.Optional(Type.Number()),
};
const OverseerSubtaskSchema = Type.Object(OverseerPlanNodeBaseFields);
const OverseerTaskSchema = Type.Object({
    ...OverseerPlanNodeBaseFields,
    subtasks: Type.Array(OverseerSubtaskSchema),
});
const OverseerPhaseSchema = Type.Object({
    ...OverseerPlanNodeBaseFields,
    tasks: Type.Array(OverseerTaskSchema),
});
const OverseerPlanSchema = Type.Object({
    planVersion: Type.Number(),
    phases: Type.Array(OverseerPhaseSchema),
});
const OverseerGoalDetailSchema = Type.Object({
    goalId: Type.String(),
    title: Type.String(),
    createdAt: Type.Number(),
    updatedAt: Type.Number(),
    status: Type.String(),
    priority: Type.String(),
    tags: Type.Array(Type.String()),
    problemStatement: Type.String(),
    successCriteria: Type.Array(Type.String()),
    nonGoals: Type.Array(Type.String()),
    constraints: Type.Optional(Type.Array(Type.String())),
    owner: Type.Optional(Type.String()),
    stakeholders: Type.Optional(Type.Array(Type.String())),
    repoContextSnapshot: Type.Optional(Type.String()),
    assumptions: Type.Optional(Type.Array(Type.String())),
    risks: Type.Optional(Type.Array(Type.Object({
        risk: Type.String(),
        impact: Type.Optional(Type.String()),
        mitigation: Type.Optional(Type.String()),
    }))),
    plan: Type.Optional(OverseerPlanSchema),
});
const OverseerAssignmentDetailSchema = Type.Object({
    assignmentId: Type.String(),
    goalId: Type.String(),
    workNodeId: Type.String(),
    status: Type.String(),
    agentId: Type.Optional(Type.String()),
    sessionKey: Type.Optional(Type.String()),
    runId: Type.Optional(Type.String()),
    createdAt: Type.Number(),
    updatedAt: Type.Number(),
    lastDispatchAt: Type.Optional(Type.Number()),
    lastObservedActivityAt: Type.Optional(Type.Number()),
    expectedNextUpdateAt: Type.Optional(Type.Number()),
    idleAfterMs: Type.Optional(Type.Number()),
    retryCount: Type.Optional(Type.Number()),
    lastRetryAt: Type.Optional(Type.Number()),
    backoffUntil: Type.Optional(Type.Number()),
    recoveryPolicy: Type.Optional(Type.String()),
    blockedReason: Type.Optional(Type.String()),
});
const OverseerCrystallizationSchema = Type.Object({
    crystallizationId: Type.String(),
    goalId: Type.String(),
    workNodeId: Type.Optional(Type.String()),
    summary: Type.Optional(Type.String()),
    currentState: Type.Optional(Type.String()),
    decisions: Type.Optional(Type.Array(Type.String())),
    nextActions: Type.Optional(Type.Array(Type.String())),
    openQuestions: Type.Optional(Type.Array(Type.String())),
    knownBlockers: Type.Optional(Type.Array(Type.String())),
    evidence: Type.Optional(Type.Object({
        filesTouched: Type.Optional(Type.Array(Type.String())),
        commandsRun: Type.Optional(Type.Array(Type.String())),
        testsRun: Type.Optional(Type.Array(Type.String())),
        commits: Type.Optional(Type.Array(Type.String())),
        prs: Type.Optional(Type.Array(Type.String())),
        issues: Type.Optional(Type.Array(Type.String())),
        externalRefs: Type.Optional(Type.Array(Type.String())),
    })),
    createdAt: Type.Number(),
});
const OverseerEventSchema = Type.Object({
    ts: Type.Number(),
    type: Type.String(),
    goalId: Type.Optional(Type.String()),
    assignmentId: Type.Optional(Type.String()),
    workNodeId: Type.Optional(Type.String()),
});
export const OverseerGoalStatusResultSchema = Type.Object({
    ts: Type.Number(),
    goal: Type.Optional(OverseerGoalDetailSchema),
    assignments: Type.Array(OverseerAssignmentDetailSchema),
    crystallizations: Type.Array(OverseerCrystallizationSchema),
    events: Type.Array(OverseerEventSchema),
});
export const OverseerWorkUpdateParamsSchema = Type.Object({
    goalId: Type.String(),
    workNodeId: Type.String(),
    status: Type.Optional(Type.String()),
    blockedReason: Type.Optional(Type.String()),
    summary: Type.Optional(Type.String()),
    evidence: Type.Optional(Type.Object({
        filesTouched: Type.Optional(Type.Array(Type.String())),
        commandsRun: Type.Optional(Type.Array(Type.String())),
        testsRun: Type.Optional(Type.Array(Type.String())),
        commits: Type.Optional(Type.Array(Type.String())),
        prs: Type.Optional(Type.Array(Type.String())),
        issues: Type.Optional(Type.Array(Type.String())),
        externalRefs: Type.Optional(Type.Array(Type.String())),
    })),
});
export const OverseerTickParamsSchema = Type.Object({
    reason: Type.Optional(Type.String()),
});
