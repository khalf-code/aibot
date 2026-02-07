# schedule-intro-call

Schedule an introductory call with a sales lead by checking calendar availability and creating an event.

BIZ-013 to BIZ-016 (#105-#108)

## What It Does

Given lead and host details, this skill:

- **Proposes time slots** during business hours (up to 3)
- **Books a calendar event** with both parties (when integrated with calendar API)
- **Generates an invite link** for the meeting
- Respects preferred date ranges and meeting duration

## Manifest

See `manifest.yaml` for permissions and configuration. This skill uses the `cli-runner` tool, requires a `CALENDAR_API_KEY` secret, and is allowed to access Google and Microsoft calendar API domains.

## Usage

### Input

```json
{
  "leadName": "Jane Doe",
  "leadEmail": "jane@acmecorp.com",
  "hostEmail": "alex@openclaw.ai",
  "hostName": "Alex Rivera",
  "durationMinutes": 30,
  "leadTimezone": "America/New_York",
  "preferredAfter": "2026-02-10T09:00:00.000Z",
  "preferredBefore": "2026-02-14T17:00:00.000Z"
}
```

| Field             | Type   | Required | Description                             |
| ----------------- | ------ | -------- | --------------------------------------- |
| `leadName`        | string | yes      | Lead's display name                     |
| `leadEmail`       | string | yes      | Lead's email (for invite)               |
| `hostEmail`       | string | yes      | Host/rep's email                        |
| `hostName`        | string | yes      | Host/rep's display name                 |
| `durationMinutes` | number | no       | Meeting length in minutes (default: 30) |
| `leadTimezone`    | string | no       | IANA timezone (e.g. "America/New_York") |
| `preferredAfter`  | string | no       | Earliest date to propose (ISO 8601)     |
| `preferredBefore` | string | no       | Latest date to propose (ISO 8601)       |
| `title`           | string | no       | Custom meeting title                    |

### Output

```json
{
  "success": true,
  "proposedSlots": [{ "start": "2026-02-10T09:00:00.000Z", "end": "2026-02-10T09:30:00.000Z" }],
  "bookedSlot": null,
  "eventId": null,
  "eventLink": null,
  "title": "Intro Call: Alex Rivera <> Jane Doe",
  "scheduledAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample scheduling request
- `fixtures/output.json` -- expected proposed slots

## Testing

```bash
pnpm vitest run skills/schedule-intro-call/tests/index.test.ts
```

## Failure Modes

- **Missing lead/host fields** -- returns error with missing field name.
- **No available slots** -- proposedSlots will be empty; bookedSlot null.
- **Calendar API unavailable** -- returns error from the API integration layer.

## Status

Stub implementation generates candidate business-hour slots. Calendar API integration (Google/Microsoft) is marked as TODO for production use.
