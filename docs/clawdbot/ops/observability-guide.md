# Observability Guide

> Documentation for the Clawdbot observability stack (issues #85 -- #92).

This guide covers the observability primitives built into the Clawdbot runtime:
structured logging, metrics collection, error classification, media capture,
golden run testing, canary deployments, and load testing.

---

## Architecture Overview

```
+------------------+     +------------------+     +------------------+
|  Structured      |     |  Metrics         |     |  Error           |
|  Logger          |---->|  Collector       |---->|  Taxonomy        |
|  (OBS-001)       |     |  (OBS-002)       |     |  (OBS-003)       |
+------------------+     +------------------+     +------------------+
         |                        |                        |
         v                        v                        v
+------------------+     +------------------+     +------------------+
|  Capture         |     |  Golden Runs     |     |  Canary          |
|  Toggles         |     |  (OBS-005)       |     |  Workflows       |
|  (OBS-004)       |     |                  |     |  (OBS-006)       |
+------------------+     +------------------+     +------------------+
                                  |
                                  v
                         +------------------+
                         |  Load Test       |
                         |  Harness         |
                         |  (OBS-008)       |
                         +------------------+
```

All modules are exported from `src/clawdbot/observability/index.ts`.

---

## Structured Logging (OBS-001, #85)

**File:** `src/clawdbot/observability/logging.ts`

The structured logger produces JSON-formatted log entries with contextual
metadata (run ID, skill name, step ID, trace ID). Every entry includes a
severity level, timestamp, and optional error details.

### Usage

```typescript
import { StructuredLogger, LogLevel } from "../clawdbot/observability/index.js";

const logger = new StructuredLogger(LogLevel.Debug);

logger.info("Run started", { runId: "run-001", skillName: "enrich-lead" });

// Child loggers inherit context
const runLogger = logger.child({ runId: "run-001" });
runLogger.debug("Step executing", { stepId: "step-1" });
```

### Log Levels

| Level   | When to use                                                 |
| ------- | ----------------------------------------------------------- |
| `debug` | Verbose detail for development / troubleshooting            |
| `info`  | Normal operational events                                   |
| `warn`  | Recoverable issues that deserve attention                   |
| `error` | Failures that affect the current operation                  |
| `fatal` | Unrecoverable failures (typically followed by process exit) |

---

## Metrics Collection (OBS-002, #86)

**File:** `src/clawdbot/observability/metrics.ts`

Three metric types are supported:

- **Counters** -- monotonically increasing values (e.g. total requests).
- **Gauges** -- point-in-time values (e.g. active runs).
- **Histograms** -- distribution of observations (e.g. latency).

### Usage

```typescript
import { InMemoryMetrics } from "../clawdbot/observability/index.js";

const metrics = new InMemoryMetrics();

metrics.increment("run.completed", 1, { skill: "enrich-lead" });
metrics.gauge("runs.active", 3);
metrics.observe("step.latency_ms", 142);

const snapshot = metrics.snapshot();
```

### Default Histogram Buckets

Latency histograms use these default bucket boundaries (ms):
`5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000`

Custom boundaries can be passed to the `InMemoryMetrics` constructor.

---

## Error Taxonomy (OBS-003, #87)

**File:** `src/clawdbot/observability/error-taxonomy.ts`

Every error is classified with:

- **Code** -- machine-readable identifier (e.g. `TOOL_BROWSER_TIMEOUT`).
- **Category** -- domain bucket (`tool`, `skill`, `workflow`, `network`, `auth`, `validation`, `timeout`, `quota`, `internal`).
- **Severity** -- `low`, `medium`, `high`, `critical`.
- **Retryable** -- whether the error is safe to retry.
- **Remediation** -- suggested fix for operators.

### Usage

```typescript
import { classifyError } from "../clawdbot/observability/index.js";

try {
  await executeTool();
} catch (err) {
  const classified = classifyError(err as Error, "TOOL_BROWSER_TIMEOUT");
  logger.error(classified.message, err as Error, { code: classified.code });
}
```

---

## Screenshot/Video Capture Toggles (OBS-004, #88)

**File:** `src/clawdbot/observability/capture.ts`

Capture modes control when media is recorded:

| Mode         | Behaviour                      |
| ------------ | ------------------------------ |
| `off`        | Never capture                  |
| `on_failure` | Capture only when a step fails |
| `on_step`    | Capture at every step boundary |
| `always`     | Continuous capture             |

The `shouldCapture()` function evaluates the current config, media type,
and execution context to decide whether to trigger a capture.

### Usage

```typescript
import { shouldCapture, DEFAULT_CAPTURE_CONFIG } from "../clawdbot/observability/index.js";

if (
  shouldCapture(DEFAULT_CAPTURE_CONFIG, "screenshot", {
    stepFailed: true,
    atStepBoundary: true,
    skillName: "enrich-lead",
  })
) {
  // take screenshot
}
```

---

## Golden Run Fixtures (OBS-005, #89)

**File:** `src/clawdbot/observability/golden-runs.ts`

A golden run is a recorded, known-good skill execution. Use `compareRun()`
to diff an actual run against the golden fixture and detect regressions.

### Usage

```typescript
import { compareRun } from "../clawdbot/observability/index.js";
import type { GoldenRun } from "../clawdbot/observability/index.js";

const golden: GoldenRun = { /* loaded from fixture file */ };
const actual = { output: result, steps: [...] };

const comparison = compareRun(golden, actual);
if (!comparison.passed) {
  console.log(`Regression detected: ${comparison.failedStepCount} steps diverged.`);
}
```

### What Gets Compared

- Tool call names at each step.
- Step outputs (deep equality via JSON serialisation).
- Step durations (range-based tolerance).
- Final skill output.

---

## Canary Workflows (OBS-006, #90)

**File:** `src/clawdbot/observability/canary.ts`

Canary deployments gradually shift traffic from a baseline skill version
to a canary version while monitoring health metrics. If thresholds are
violated, traffic is automatically rolled back.

### Lifecycle

```
pending -> running -> [promoting | rolling_back] -> [promoted | rolled_back | failed]
```

### Configuration

Key thresholds:

- `maxErrorRate` -- maximum allowed error rate (0.0 - 1.0).
- `maxP99LatencyMs` -- maximum p99 latency in milliseconds.
- `minSuccessRate` -- minimum required success rate (0.0 - 1.0).

---

## Load Test Harness (OBS-008, #92)

**File:** `src/clawdbot/observability/load-test.ts`

The load test harness validates skill throughput and latency under
configurable load.

### Configuration

```typescript
import { LoadTestRunner } from "../clawdbot/observability/index.js";
import type { LoadTestConfig } from "../clawdbot/observability/index.js";

const config: LoadTestConfig = {
  name: "enrich-lead-baseline",
  scenarios: [
    {
      name: "standard",
      skillName: "enrich-lead",
      input: { url: "https://example.com" },
      weight: 1,
    },
  ],
  concurrency: 10,
  durationMs: 60_000,
  targetRps: 0, // max throughput
  rampUpMs: 5_000,
  maxP99LatencyMs: 2_000,
  maxErrorRate: 0.01,
};

const runner = new LoadTestRunner(config);
const result = await runner.run();
```

### Result Metrics

- Total requests, success/failure counts, error rate.
- Latency percentiles: p50, p90, p95, p99, max.
- Per-scenario breakdown.
- Pass/fail verdict based on configured thresholds.

---

## Backup and Restore

See the dedicated [Backup and Restore Procedures](/clawdbot/ops/backup-restore)
document for instructions covering Postgres, Redis, n8n data, skill bundles,
and artifacts.
