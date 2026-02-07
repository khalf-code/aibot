# escalate-sla-breach

> BIZ-033 to BIZ-036 (#125-#128)

Detect SLA breaches on support tickets and auto-escalate to the appropriate tier or manager.

## What it does

Given a support ticket's timing data and priority, this skill checks against configurable SLA thresholds for:

- **First response time** -- how long until the first agent reply
- **Resolution time** -- how long until the ticket is marked resolved
- **Update cadence** -- maximum gap between successive agent updates

When any threshold is breached, the skill returns an escalation plan with the new tier assignment, manager notification flag, and tracking tags.

## Directory layout

```
manifest.yaml          Permissions, metadata, and runtime configuration.
src/index.ts           Skill implementation. Exports an execute() function.
tests/index.test.ts    Vitest tests using fixture-based assertions.
fixtures/input.json    Sample input: overdue high-priority ticket.
fixtures/output.json   Expected output for the sample input.
README.md              This file.
```

## Configuration

Default SLA thresholds (in minutes):

| Priority | First Response | Resolution | Update Cadence |
| -------- | -------------- | ---------- | -------------- |
| Critical | 15             | 240        | 30             |
| High     | 60             | 480        | 60             |
| Medium   | 240            | 1440       | 240            |
| Low      | 480            | 2880       | 480            |

Pass `customThresholds` in the input to override per-customer or per-ticket SLAs.

## Testing

```bash
pnpm vitest run skills/escalate-sla-breach/tests/index.test.ts
```

## Failure modes

- **Missing ticketId** -- Returns `{ success: false }` with a validation error.
- **Invalid timestamp formats** -- JavaScript Date parsing may produce NaN; the skill catches and returns an error.
- **Ticketing API unreachable** -- When integrated with a live API, network errors are caught and returned as structured errors.

## Observability

BIZ-036 (#128) adds the following metrics:

- `escalate_sla.check_total` -- Counter of total SLA checks performed.
- `escalate_sla.breach_total` -- Counter of breaches detected, labeled by breach type.
- `escalate_sla.escalation_total` -- Counter of escalation actions taken.
- `escalate_sla.check_latency_ms` -- Histogram of skill execution latency.
