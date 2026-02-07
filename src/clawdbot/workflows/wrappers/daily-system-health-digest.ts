/**
 * BIZ-062 (#154) — Workflow wrapper: Daily system health digest
 *
 * Orchestrates the daily system health digest workflow:
 *   1. Collect health check results from all monitored services.
 *   2. Detect issues and compute aggregate metrics.
 *   3. If critical issues are found, pause for ops-lead acknowledgment.
 *   4. Distribute the digest to the team.
 */

import type {
  HealthCheckResult,
  HealthDigest,
  HealthDigestGateConfig,
  HealthDigestGateSnapshot,
  HealthIssue,
  ServiceStatus,
} from "../gates/daily-system-health-digest.js";
import {
  DEFAULT_HEALTH_DIGEST_GATE_CONFIG,
  computeOverallStatus,
  evaluateAlerts,
  requiresAcknowledgment,
} from "../gates/daily-system-health-digest.js";

// ---------------------------------------------------------------------------
// Workflow input / output types
// ---------------------------------------------------------------------------

/** Input for the daily system health digest workflow. */
export type DailyHealthDigestInput = {
  /** Start of the reporting period (ISO-8601). */
  periodStart: string;
  /** End of the reporting period (ISO-8601). */
  periodEnd: string;
  /** Health check results from all monitored services. */
  services: HealthCheckResult[];
  /** Detected issues (may be pre-populated by monitoring tools). */
  issues?: HealthIssue[];
  /** Optional gate configuration overrides. */
  gateConfig?: Partial<HealthDigestGateConfig>;
};

/** Output from the daily system health digest workflow. */
export type DailyHealthDigestOutput = {
  /** Whether the workflow completed successfully. */
  success: boolean;
  /** Error message if the workflow failed. */
  error?: string;
  /** The generated health digest. */
  digest: HealthDigest;
  /** The gate snapshot for acknowledgment/distribution. */
  snapshot: HealthDigestGateSnapshot;
  /** Whether the digest requires ops-lead acknowledgment. */
  pendingAcknowledgment: boolean;
  /** Whether the digest was auto-distributed (no alerts). */
  autoDistributed: boolean;
  /** Human-readable summary. */
  summary: string;
};

// ---------------------------------------------------------------------------
// Issue detection
// ---------------------------------------------------------------------------

/**
 * Detect issues from health check results that were not already provided.
 *
 * @param services - Health check results.
 * @returns Detected issues.
 */
function detectIssues(services: HealthCheckResult[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const now = new Date().toISOString();

  for (const svc of services) {
    // Service is down
    if (svc.status === "down") {
      issues.push({
        serviceName: svc.serviceName,
        severity: "critical",
        description: `${svc.serviceName} is down and unreachable.`,
        detectedAt: now,
        suggestedAction:
          "Check service logs and restart if necessary. Verify network connectivity.",
      });
    }

    // Service is degraded
    if (svc.status === "degraded") {
      issues.push({
        serviceName: svc.serviceName,
        severity: "warning",
        description: `${svc.serviceName} is degraded (response time: ${svc.responseTimeMs ?? "N/A"}ms).`,
        detectedAt: now,
        suggestedAction: "Monitor resource utilization and scale up if needed.",
      });
    }

    // High error rate
    if (svc.errorCount24h > 100) {
      issues.push({
        serviceName: svc.serviceName,
        severity: svc.errorCount24h > 1000 ? "critical" : "warning",
        description: `${svc.serviceName} has ${svc.errorCount24h} errors in the last 24 hours.`,
        detectedAt: now,
        suggestedAction:
          "Review error logs for patterns. Check recent deployments for regressions.",
      });
    }

    // High disk utilization
    if (svc.diskPercent !== null && svc.diskPercent > 90) {
      issues.push({
        serviceName: svc.serviceName,
        severity: svc.diskPercent > 95 ? "critical" : "warning",
        description: `${svc.serviceName} disk utilization at ${svc.diskPercent}%.`,
        detectedAt: now,
        suggestedAction: "Clean up old logs/data or expand disk capacity.",
      });
    }

    // High memory utilization
    if (svc.memoryPercent !== null && svc.memoryPercent > 90) {
      issues.push({
        serviceName: svc.serviceName,
        severity: svc.memoryPercent > 95 ? "critical" : "warning",
        description: `${svc.serviceName} memory utilization at ${svc.memoryPercent}%.`,
        detectedAt: now,
        suggestedAction: "Investigate memory leaks or increase available memory.",
      });
    }

    // Low uptime
    if (svc.uptimePercent24h < 99) {
      issues.push({
        serviceName: svc.serviceName,
        severity: svc.uptimePercent24h < 95 ? "critical" : "warning",
        description: `${svc.serviceName} uptime is ${svc.uptimePercent24h}% over the last 24 hours.`,
        detectedAt: now,
        suggestedAction: "Review outage timeline and identify root cause.",
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

/**
 * Execute the daily system health digest workflow.
 *
 * @param input - Service health data and optional configuration.
 * @returns Health digest, alerts, and acknowledgment status.
 */
export async function executeDailyHealthDigest(
  input: DailyHealthDigestInput,
): Promise<DailyHealthDigestOutput> {
  const config: HealthDigestGateConfig = {
    ...DEFAULT_HEALTH_DIGEST_GATE_CONFIG,
    ...input.gateConfig,
  };

  try {
    const services = input.services;

    // Detect issues (merge with any pre-provided issues)
    const detectedIssues = detectIssues(services);
    const allIssues = [...(input.issues ?? []), ...detectedIssues];

    // Compute aggregate metrics
    const reachableServices = services.filter((s) => s.responseTimeMs !== null);
    const avgResponseTimeMs =
      reachableServices.length > 0
        ? reachableServices.reduce((sum, s) => sum + (s.responseTimeMs ?? 0), 0) /
          reachableServices.length
        : 0;
    const avgUptimePercent =
      services.length > 0
        ? services.reduce((sum, s) => sum + s.uptimePercent24h, 0) / services.length
        : 0;

    const overallStatus: ServiceStatus = computeOverallStatus(services);

    const digest: HealthDigest = {
      generatedAt: new Date().toISOString(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      overallStatus,
      totalServices: services.length,
      healthyCount: services.filter((s) => s.status === "healthy").length,
      degradedCount: services.filter((s) => s.status === "degraded").length,
      downCount: services.filter((s) => s.status === "down").length,
      services,
      issues: allIssues,
      avgResponseTimeMs: Math.round(avgResponseTimeMs),
      avgUptimePercent: Math.round(avgUptimePercent * 100) / 100,
    };

    // Evaluate gate alerts
    const alertsTriggered = evaluateAlerts(digest, config);
    const needsAck = requiresAcknowledgment(alertsTriggered);

    const snapshot: HealthDigestGateSnapshot = {
      digest,
      alertsTriggered,
      evaluatedAt: new Date().toISOString(),
    };

    // Build summary
    const statusEmoji: Record<ServiceStatus, string> = {
      healthy: "OK",
      degraded: "DEGRADED",
      down: "DOWN",
      unknown: "UNKNOWN",
    };
    const summary = [
      `System status: ${statusEmoji[overallStatus]}.`,
      `${digest.healthyCount}/${digest.totalServices} services healthy.`,
      digest.downCount > 0 ? `${digest.downCount} service(s) down.` : null,
      digest.degradedCount > 0 ? `${digest.degradedCount} service(s) degraded.` : null,
      `${allIssues.length} issue(s) detected.`,
      needsAck ? "Ops-lead acknowledgment required." : "Auto-distributed.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      success: true,
      digest,
      snapshot,
      pendingAcknowledgment: needsAck,
      autoDistributed: !needsAck,
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      digest: {
        generatedAt: new Date().toISOString(),
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        overallStatus: "unknown",
        totalServices: 0,
        healthyCount: 0,
        degradedCount: 0,
        downCount: 0,
        services: [],
        issues: [],
        avgResponseTimeMs: 0,
        avgUptimePercent: 0,
      },
      snapshot: {
        digest: {
          generatedAt: new Date().toISOString(),
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          overallStatus: "unknown",
          totalServices: 0,
          healthyCount: 0,
          degradedCount: 0,
          downCount: 0,
          services: [],
          issues: [],
          avgResponseTimeMs: 0,
          avgUptimePercent: 0,
        },
        alertsTriggered: [],
        evaluatedAt: new Date().toISOString(),
      },
      pendingAcknowledgment: false,
      autoDistributed: false,
      summary: `Health digest workflow failed: ${message}`,
    };
  }
}
