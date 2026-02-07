/**
 * Clawdbot observability stack -- barrel export
 *
 * Re-exports every observability module so consumers can import from
 * a single path:
 *   import { StructuredLogger, InMemoryMetrics, ... } from "../clawdbot/observability/index.js";
 */

// OBS-001 (#85) Structured logging
export { LogLevel, StructuredLogger } from "./logging.js";
export type { LogContext, LogEntry, Logger } from "./logging.js";

// OBS-002 (#86) Metrics: success rate + latency
export { DEFAULT_HISTOGRAM_BUCKETS, InMemoryMetrics } from "./metrics.js";
export type {
  MetricType,
  Metric,
  MetricBucket,
  HistogramData,
  MetricsSnapshot,
  MetricsCollector,
} from "./metrics.js";

// OBS-003 (#87) Error taxonomy
export { errorTaxonomy, classifyError } from "./error-taxonomy.js";
export type { ErrorCategory, ErrorSeverity, ClassifiedError } from "./error-taxonomy.js";

// OBS-004 (#88) Screenshot/video capture toggles
export { DEFAULT_CAPTURE_CONFIG, shouldCapture } from "./capture.js";
export type { CaptureMode, CaptureConfig, CaptureResult } from "./capture.js";

// OBS-005 (#89) Golden run fixtures
export { compareRun } from "./golden-runs.js";
export type {
  GoldenRun,
  GoldenRunStep,
  StepComparisonResult,
  ComparisonResult,
} from "./golden-runs.js";

// OBS-006 (#90) Canary workflows
export { StubCanaryWorkflow } from "./canary.js";
export type {
  CanaryStatus,
  CanaryConfig,
  CanaryPhaseMetrics,
  CanaryResult,
  CanaryWorkflow,
} from "./canary.js";

// OBS-008 (#92) Load test harness
export { LoadTestRunner } from "./load-test.js";
export type {
  LoadTestScenario,
  LoadTestConfig,
  LoadTestRequestResult,
  LoadTestResult,
} from "./load-test.js";
