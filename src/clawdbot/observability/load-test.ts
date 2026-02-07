/**
 * OBS-008 (#92) -- Load test harness (basic)
 *
 * Types and a stub runner for load testing Clawdbot skill execution.
 * The harness supports configurable concurrency, duration, and scenario
 * definitions to validate throughput and latency under load.
 */

// ---------------------------------------------------------------------------
// Load test scenario
// ---------------------------------------------------------------------------

/** A single scenario (test case) within a load test. */
export type LoadTestScenario = {
  /** Human-readable name for this scenario. */
  name: string;
  /** Skill name to invoke. */
  skillName: string;
  /** Input payload to pass to the skill. */
  input: unknown;
  /**
   * Weight for weighted random selection when multiple scenarios are
   * defined (higher weight = more frequent). Defaults to 1.
   */
  weight: number;
};

// ---------------------------------------------------------------------------
// Load test config
// ---------------------------------------------------------------------------

/** Top-level configuration for a load test run. */
export type LoadTestConfig = {
  /** Human-readable name for this load test. */
  name: string;
  /** One or more scenarios to execute during the test. */
  scenarios: LoadTestScenario[];
  /** Number of concurrent virtual users. */
  concurrency: number;
  /** Total test duration in milliseconds. */
  durationMs: number;
  /** Target requests per second (0 = unlimited / max throughput). */
  targetRps: number;
  /** Ramp-up period in milliseconds (linearly scales from 0 to target concurrency). */
  rampUpMs: number;
  /** Maximum acceptable p99 latency in milliseconds (used for pass/fail). */
  maxP99LatencyMs: number;
  /** Maximum acceptable error rate (0.0 - 1.0, used for pass/fail). */
  maxErrorRate: number;
};

// ---------------------------------------------------------------------------
// Per-request result
// ---------------------------------------------------------------------------

/** Outcome of a single request during the load test. */
export type LoadTestRequestResult = {
  /** Scenario that was executed. */
  scenarioName: string;
  /** Whether the request succeeded. */
  success: boolean;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** Error message if the request failed. */
  error?: string;
  /** ISO-8601 timestamp of when the request started. */
  startedAt: string;
};

// ---------------------------------------------------------------------------
// Load test result
// ---------------------------------------------------------------------------

/** Aggregated result of a completed load test. */
export type LoadTestResult = {
  /** Load test name (from config). */
  name: string;
  /** Whether the test passed all thresholds. */
  passed: boolean;
  /** Total number of requests executed. */
  totalRequests: number;
  /** Number of successful requests. */
  successCount: number;
  /** Number of failed requests. */
  failureCount: number;
  /** Computed error rate (0.0 - 1.0). */
  errorRate: number;
  /** Achieved requests per second. */
  actualRps: number;
  /** Latency percentiles in milliseconds. */
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
  };
  /** Per-scenario breakdown. */
  scenarioResults: Array<{
    scenarioName: string;
    requestCount: number;
    successCount: number;
    errorRate: number;
    avgLatencyMs: number;
  }>;
  /** ISO-8601 timestamp of when the test started. */
  startedAt: string;
  /** ISO-8601 timestamp of when the test completed. */
  completedAt: string;
  /** Total wall-clock duration of the test in milliseconds. */
  durationMs: number;
};

// ---------------------------------------------------------------------------
// LoadTestRunner class
// ---------------------------------------------------------------------------

/**
 * Stub load test runner for development and testing.
 *
 * The real implementation should:
 *   1. Spawn virtual users according to concurrency + ramp-up config.
 *   2. Select scenarios via weighted random distribution.
 *   3. Execute skill runs through the Clawdbot runtime.
 *   4. Collect per-request latency and success/failure data.
 *   5. Compute aggregate statistics and compare against thresholds.
 *
 * Replace this stub with the real implementation when ready.
 */
export class LoadTestRunner {
  private running = false;
  private results: LoadTestRequestResult[] = [];

  constructor(
    /** Load test configuration. */
    private readonly config: LoadTestConfig,
  ) {}

  /**
   * Start the load test.
   *
   * @returns The aggregated load test result once the test completes.
   * @throws If a test is already running.
   */
  async run(): Promise<LoadTestResult> {
    if (this.running) {
      throw new Error("A load test is already running.");
    }
    this.running = true;
    this.results = [];

    const startedAt = new Date().toISOString();

    // TODO: implement virtual user spawning, ramp-up, scenario selection,
    // and request execution against the Clawdbot runtime.
    // For now, return a zeroed-out result.

    this.running = false;

    return {
      name: this.config.name,
      passed: true,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      errorRate: 0,
      actualRps: 0,
      latency: { p50: 0, p90: 0, p95: 0, p99: 0, max: 0 },
      scenarioResults: this.config.scenarios.map((s) => ({
        scenarioName: s.name,
        requestCount: 0,
        successCount: 0,
        errorRate: 0,
        avgLatencyMs: 0,
      })),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  /**
   * Abort a running load test.
   */
  abort(): void {
    // TODO: signal virtual users to stop and drain in-flight requests.
    this.running = false;
  }

  /**
   * Check whether a load test is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the raw per-request results collected so far.
   * Useful for streaming progress updates during a long test.
   */
  getIntermediateResults(): readonly LoadTestRequestResult[] {
    return [...this.results];
  }
}
