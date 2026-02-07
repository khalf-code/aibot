# draft-first-response-email

Draft a personalized first-response email to an inbound sales lead based on their inquiry details.

BIZ-009 to BIZ-012 (#101-#104)

## What It Does

Given parsed lead information (name, company, intent, signals), this skill generates:

- **Subject line** tailored to the lead's intent and company
- **Email body** with appropriate greeting, context paragraph, and sign-off
- **Call-to-action** matched to the inquiry type (demo, pricing, partnership, etc.)

Supports three tone settings: formal, friendly (default), and casual.

## Manifest

See `manifest.yaml` for permissions and configuration. This skill uses the `email-runner` tool and requires human approval before sending.

## Usage

### Input

```json
{
  "leadName": "Jane Doe",
  "leadEmail": "jane@acmecorp.com",
  "company": "Acme Corp",
  "intent": "demo request",
  "intentSignals": ["interested in a demo"],
  "senderName": "Alex Rivera",
  "senderTitle": "Account Executive",
  "tone": "friendly"
}
```

| Field           | Type     | Required | Description                                             |
| --------------- | -------- | -------- | ------------------------------------------------------- |
| `leadName`      | string   | yes      | Lead's display name                                     |
| `leadEmail`     | string   | yes      | Lead's email address                                    |
| `company`       | string   | no       | Company name (null for free-email leads)                |
| `intent`        | string   | yes      | Intent category from parsed email                       |
| `intentSignals` | string[] | yes      | Key phrases from the original email                     |
| `senderName`    | string   | yes      | Your name for the signature                             |
| `senderTitle`   | string   | yes      | Your title for the signature                            |
| `tone`          | string   | no       | "formal", "friendly", or "casual" (default: "friendly") |

### Output

```json
{
  "success": true,
  "subject": "Re: Demo request for Acme Corp -- next steps",
  "body": "Hi Jane Doe,\n\nThanks for reaching out!...",
  "callToAction": "Would any of the following times work for a 30-minute demo call?",
  "draftedAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample lead data
- `fixtures/output.json` -- expected drafted email

## Testing

```bash
pnpm vitest run skills/draft-first-response-email/tests/index.test.ts
```

## Failure Modes

- **Missing leadName** -- returns `{ success: false, error: "Missing or invalid 'leadName'..." }`.
- **Missing leadEmail** -- returns `{ success: false, error: "Missing or invalid 'leadEmail'..." }`.

## Status

Template-based drafting implementation. LLM-powered context-aware drafting is marked as TODO for production use.
