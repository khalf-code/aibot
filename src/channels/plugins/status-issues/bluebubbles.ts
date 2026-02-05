export function collectBlueBubblesStatusIssues(
  accounts: ChannelAccountSnapshot[],
): ChannelStatusIssue[] {
  const issues: ChannelStatusIssue[] = [];
  for (const entry of accounts) {
    const account = readBlueBubblesAccountStatus(entry);
    if (!account) {
      continue;
    }
    const accountId = asString(account.accountId) ?? "default";
    const enabled = account.enabled !== false;
    if (!enabled) {
      continue;
    }

    const configured = account.configured === true;
    const running = account.running === true;
    const lastError = asString(account.lastError);
    const probe = readBlueBubblesProbeResult(account.probe);

    // Check for unconfigured accounts
    if (!configured) {
      issues.push({
        channel: "bluebubbles",
        accountId,
        kind: "config",
        message: "Not configured (missing serverUrl or password)" // Fixed incomplete message
      });
    }

    // Check for errors
    if (lastError) {
      issues.push({
        channel: "bluebubbles",
        accountId,
        kind: "error",
        message: lastError
      });
    }

    // Check for non-running status
    if (!running) {
      issues.push({
        channel: "bluebubbles",
        accountId,
        kind: "runtime",
        message: "Service is not running"
      });
    }

    // Check probe results
    if (probe && !probe.ok) {
      const probeMessage = `Probe failed with status ${probe.status ?? 'unknown'}: ${probe.error ?? 'no error message provided'}`;
      issues.push({
        channel: "bluebubbles",
        accountId,
        kind: "network",
        message: probeMessage
      });
    }
  }
  return issues;
}