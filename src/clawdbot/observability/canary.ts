/**
 * OBS-006 (#90) -- Canary workflows
 *
 * Types and interface for canary deployment workflows. A canary workflow
 * gradually rolls out a new skill version to a small subset of traffic,
 * monitors health signals, and automatically promotes or rolls back
 * based on configurable thresholds.
 */

// ---------------------------------------------------------------------------
// Canary status
// ---------------------------------------------------------------------------

/** Lifecycle status of a canary deployment. */
export type CanaryStatus =
  | "pending"
  | "running"
  | "promoting"
  | "rolling_back"
  | "promoted"
  | "rolled_back"
  | "failed";

// ---------------------------------------------------------------------------
// Canary config
// ---------------------------------------------------------------------------

/** Configuration for a canary deployment. */
export type CanaryConfig = {
  /** Name of the skill being canaried. */
  skillName: string;
  /** Version being promoted (the "canary" version). */
  canaryVersion: string;
  /** Version currently in production (the "baseline" version). */
  baselineVersion: string;
  /** Percentage of traffic to route to the canary (0-100). */
  trafficPercentage: number;
  /** Duration of each canary phase in milliseconds. */
  phaseDurationMs: number;
  /** Number of progressive phases before full promotion. */
  phaseCount: number;
  /** Minimum number of requests before health can be evaluated. */
  minSampleSize: number;
  /** Health thresholds that must be met to continue promotion. */
  thresholds: {
    /** Maximum allowed error rate (0.0 - 1.0). */
    maxErrorRate: number;
    /** Maximum allowed p99 latency in milliseconds. */
    maxP99LatencyMs: number;
    /** Minimum required success rate (0.0 - 1.0). */
    minSuccessRate: number;
  };
  /** Whether to automatically roll back on threshold violation. */
  autoRollback: boolean;
};

// ---------------------------------------------------------------------------
// Canary result
// ---------------------------------------------------------------------------

/** Observed health metrics for a canary phase. */
export type CanaryPhaseMetrics = {
  /** Phase index (zero-based). */
  phase: number;
  /** Traffic percentage during this phase. */
  trafficPercentage: number;
  /** Number of requests routed to the canary in this phase. */
  requestCount: number;
  /** Observed error rate (0.0 - 1.0). */
  errorRate: number;
  /** Observed success rate (0.0 - 1.0). */
  successRate: number;
  /** Observed p99 latency in milliseconds. */
  p99LatencyMs: number;
  /** Whether thresholds were met in this phase. */
  thresholdsMet: boolean;
};

/** Final result of a completed canary deployment. */
export type CanaryResult = {
  /** Skill name. */
  skillName: string;
  /** Canary version that was tested. */
  canaryVersion: string;
  /** Baseline version that was compared against. */
  baselineVersion: string;
  /** Final status of the canary deployment. */
  status: CanaryStatus;
  /** Per-phase health metrics. */
  phases: CanaryPhaseMetrics[];
  /** ISO-8601 timestamp of when the canary started. */
  startedAt: string;
  /** ISO-8601 timestamp of when the canary completed. */
  completedAt: string;
  /** Human-readable summary of the outcome. */
  summary: string;
};

// ---------------------------------------------------------------------------
// CanaryWorkflow interface
// ---------------------------------------------------------------------------

/** Contract for a canary deployment workflow engine. */
export interface CanaryWorkflow {
  /**
   * Start a new canary deployment.
   *
   * @param config - Canary configuration.
   * @returns The initial canary result (status will be "running").
   */
  start(config: CanaryConfig): Promise<CanaryResult>;

  /**
   * Check the current status of an active canary.
   *
   * @param skillName - Name of the skill being canaried.
   * @returns The current canary result, or `null` if no canary is active.
   */
  status(skillName: string): Promise<CanaryResult | null>;

  /**
   * Manually promote the canary to full production traffic.
   * Bypasses remaining phases and threshold checks.
   *
   * @param skillName - Name of the skill to promote.
   */
  promote(skillName: string): Promise<CanaryResult>;

  /**
   * Manually roll back the canary, restoring the baseline version.
   *
   * @param skillName - Name of the skill to roll back.
   */
  rollback(skillName: string): Promise<CanaryResult>;

  /**
   * Advance the canary to the next phase (increase traffic percentage).
   * Called automatically by the scheduler or manually by an operator.
   *
   * @param skillName - Name of the skill to advance.
   * @returns Updated canary result after the phase transition.
   */
  advancePhase(skillName: string): Promise<CanaryResult>;
}

// ---------------------------------------------------------------------------
// Stub implementation
// ---------------------------------------------------------------------------

/**
 * Stub canary workflow for development and testing.
 *
 * Replace with a real implementation that integrates with the runtime
 * traffic router and metrics collector for production use.
 */
export class StubCanaryWorkflow implements CanaryWorkflow {
  private active = new Map<string, CanaryResult>();

  async start(config: CanaryConfig): Promise<CanaryResult> {
    const result: CanaryResult = {
      skillName: config.skillName,
      canaryVersion: config.canaryVersion,
      baselineVersion: config.baselineVersion,
      status: "running",
      phases: [],
      startedAt: new Date().toISOString(),
      completedAt: "",
      summary: `Canary started for ${config.skillName}@${config.canaryVersion}.`,
    };
    this.active.set(config.skillName, result);
    return { ...result };
  }

  async status(skillName: string): Promise<CanaryResult | null> {
    return this.active.get(skillName) ?? null;
  }

  async promote(skillName: string): Promise<CanaryResult> {
    const result = this.active.get(skillName);
    if (!result) {
      throw new Error(`No active canary for skill "${skillName}".`);
    }
    result.status = "promoted";
    result.completedAt = new Date().toISOString();
    result.summary = `Canary promoted: ${skillName}@${result.canaryVersion} is now live.`;
    return { ...result };
  }

  async rollback(skillName: string): Promise<CanaryResult> {
    const result = this.active.get(skillName);
    if (!result) {
      throw new Error(`No active canary for skill "${skillName}".`);
    }
    result.status = "rolled_back";
    result.completedAt = new Date().toISOString();
    result.summary = `Canary rolled back: ${skillName} restored to ${result.baselineVersion}.`;
    return { ...result };
  }

  async advancePhase(skillName: string): Promise<CanaryResult> {
    const result = this.active.get(skillName);
    if (!result) {
      throw new Error(`No active canary for skill "${skillName}".`);
    }
    // TODO: integrate with MetricsCollector to evaluate health thresholds
    // and traffic router to adjust percentages.
    const nextPhase: CanaryPhaseMetrics = {
      phase: result.phases.length,
      trafficPercentage: 0, // would be computed from config
      requestCount: 0,
      errorRate: 0,
      successRate: 1,
      p99LatencyMs: 0,
      thresholdsMet: true,
    };
    result.phases.push(nextPhase);
    result.summary = `Canary phase ${nextPhase.phase} completed for ${skillName}.`;
    return { ...result };
  }
}
