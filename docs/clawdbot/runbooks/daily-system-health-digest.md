# Runbook: Daily System Health Digest

> BIZ-061 to BIZ-064 (#153-#156)

## Overview

This workflow generates a daily health digest by collecting status information from all monitored services, detecting issues, and distributing a summary report. If critical issues are detected, the digest requires ops-lead acknowledgment before distribution.

## Trigger

- **Scheduled:** Runs daily at 07:00 UTC via the workflow scheduler.
- **Manual:** Ops team can trigger an ad-hoc digest from the dashboard.

## Workflow steps

1. **Data collection** -- Query health check endpoints for all registered services.
2. **Issue detection** -- Analyze check results for:
   - Service outages (status: down)
   - Degraded performance (high latency, error spikes)
   - Resource pressure (disk > 90%, memory > 90%)
   - Low uptime (< 99% over 24 hours)
3. **Aggregation** -- Compute overall status, average response time, average uptime, and issue counts.
4. **Gate evaluation** -- If any critical alerts fire, pause for ops-lead acknowledgment.
5. **Distribution** -- Send the digest to configured channels (email, Slack).

## Alert thresholds

| Alert                  | Default threshold | Description                                |
| ---------------------- | ----------------- | ------------------------------------------ |
| Critical issues        | >= 1              | Any critical issue triggers acknowledgment |
| Down services          | >= 1              | Any service down triggers acknowledgment   |
| Low avg uptime         | < 99.0%           | Average uptime across all services         |
| High avg response time | > 2000ms          | Average response time across services      |

## Service status definitions

| Status     | Meaning                                                   |
| ---------- | --------------------------------------------------------- |
| `healthy`  | Service is operational with normal response times         |
| `degraded` | Service is responding but with elevated latency or errors |
| `down`     | Service is unreachable or returning errors                |
| `unknown`  | Health check could not determine status                   |

## Issue severity levels

| Severity   | Examples                                                   |
| ---------- | ---------------------------------------------------------- |
| `info`     | Minor metric deviation, informational notice               |
| `warning`  | Elevated error rate, disk > 90%, degraded service          |
| `critical` | Service down, disk > 95%, error count > 1000, uptime < 95% |

## Gate configuration

| Parameter                | Default              | Description                                       |
| ------------------------ | -------------------- | ------------------------------------------------- |
| `criticalIssueThreshold` | 1                    | Minimum critical issues to trigger gate           |
| `downServiceThreshold`   | 1                    | Minimum down services to trigger gate             |
| `uptimeAlertPercent`     | 99.0                 | Average uptime below this triggers gate           |
| `responseTimeAlertMs`    | 2000                 | Average response time above this triggers gate    |
| `approverRole`           | `ops-lead`           | Role required to acknowledge                      |
| `timeoutMinutes`         | 240                  | Auto-distribute after 4 hours if not acknowledged |
| `distributionChannels`   | `["email", "slack"]` | Where to send the digest                          |

## Troubleshooting

| Symptom                                | Likely cause                                                | Resolution                                        |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Digest shows all services as "unknown" | Health check endpoints unreachable from the workflow runner | Verify network access and endpoint URLs           |
| False "down" alerts                    | Transient network issue during check                        | Implement retry in health check probes            |
| Digest not distributed                 | Stuck in acknowledgment gate                                | Check timeout setting; assign backup ops lead     |
| Missing services in digest             | Service not registered in the monitoring config             | Add the service to the health check configuration |

## Related files

- Approval gate type: `src/clawdbot/workflows/gates/daily-system-health-digest.ts`
- Workflow wrapper: `src/clawdbot/workflows/wrappers/daily-system-health-digest.ts`

## Rollback

If the digest contains incorrect data:

1. Verify health check endpoint responses manually.
2. Fix any misconfigured check URLs or thresholds.
3. Re-trigger the digest for the same period.
4. If false alerts caused unnecessary escalation, post a correction note to the distribution channels.

## On-call integration

When the gate fires with critical issues:

1. Ops lead receives a notification via configured channels.
2. Ops lead reviews the digest and creates incident tickets for each critical issue.
3. Ops lead acknowledges the digest, optionally adding a comment (e.g. "Incident INC-456 created for database outage").
4. The acknowledged digest is distributed to the team with the ops lead's notes.
