# log-call-notes-crm

Log structured call notes to a CRM system after a sales or intro call.

BIZ-017 to BIZ-020 (#109-#112)

## What It Does

Given call details (participants, summary, action items), this skill:

- **Formats call notes** into a structured markdown document
- **Logs the activity** to a CRM (HubSpot or Salesforce)
- **Records action items** with owners and due dates
- **Captures sentiment** and next steps for pipeline tracking

## Manifest

See `manifest.yaml` for permissions and configuration. This skill uses the `cli-runner` tool, requires a `CRM_API_KEY` secret, and is allowed to access HubSpot and Salesforce API domains. Requires human approval.

## Usage

### Input

```json
{
  "contactId": "CRM-CONTACT-00042",
  "dealId": "CRM-DEAL-00017",
  "callDate": "2026-02-07T14:00:00.000Z",
  "durationMinutes": 30,
  "participants": ["Alex Rivera", "Jane Doe"],
  "summary": "Discussed pipeline challenges and pilot program...",
  "actionItems": [
    { "description": "Send pricing proposal", "owner": "Alex Rivera", "dueDate": "2026-02-10" }
  ],
  "sentiment": "positive",
  "nextStep": "Follow-up call Feb 14",
  "crmProvider": "hubspot"
}
```

| Field             | Type         | Required | Description                                    |
| ----------------- | ------------ | -------- | ---------------------------------------------- |
| `contactId`       | string       | yes      | CRM contact/lead ID                            |
| `dealId`          | string       | no       | CRM deal/opportunity ID                        |
| `callDate`        | string       | yes      | Call date/time (ISO 8601)                      |
| `durationMinutes` | number       | yes      | Call duration in minutes                       |
| `participants`    | string[]     | yes      | Names of call participants                     |
| `summary`         | string       | yes      | Call summary or transcript excerpt             |
| `actionItems`     | ActionItem[] | yes      | Structured action items                        |
| `sentiment`       | string       | no       | "positive", "neutral", or "negative"           |
| `nextStep`        | string       | no       | Agreed next step                               |
| `crmProvider`     | string       | no       | "hubspot" or "salesforce" (default: "hubspot") |

### Output

```json
{
  "success": true,
  "activityId": "HS-ACT-A1B2C3D4",
  "contactId": "CRM-CONTACT-00042",
  "dealId": "CRM-DEAL-00017",
  "formattedNote": "## Call Notes\n...",
  "actionItemCount": 3,
  "loggedAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample call notes with action items
- `fixtures/output.json` -- expected CRM log output

## Testing

```bash
pnpm vitest run skills/log-call-notes-crm/tests/index.test.ts
```

## Failure Modes

- **Missing contactId** -- returns error.
- **Missing summary** -- returns error.
- **CRM API unavailable** -- returns error from the integration layer.

## Status

Stub implementation formats notes and generates placeholder activity IDs. HubSpot/Salesforce API integration is marked as TODO for production use.
