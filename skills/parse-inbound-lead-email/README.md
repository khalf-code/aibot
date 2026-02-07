# parse-inbound-lead-email

Parse an inbound lead email and extract sender details, company info, intent signals, and urgency.

BIZ-001 to BIZ-004 (#93-#96)

## What It Does

Given the raw fields of an inbound email (from, subject, body), this skill extracts:

- **Sender name** and **email address** from the From header
- **Company name** inferred from the email domain
- **Intent category** (demo request, pricing inquiry, partnership, support, general)
- **Urgency level** (low, medium, high) based on keyword heuristics
- **Intent signals** -- key sentences that indicate buying intent

## Manifest

See `manifest.yaml` for permissions and configuration. This skill uses the `email-runner` tool and requires no secrets or domain access.

## Usage

### Input

```json
{
  "from": "Jane Doe <jane@acmecorp.com>",
  "subject": "Interested in a demo",
  "body": "Hi, I'm looking for a sales automation tool...",
  "receivedAt": "2026-02-07T09:15:00.000Z"
}
```

| Field        | Type   | Required | Description                             |
| ------------ | ------ | -------- | --------------------------------------- |
| `from`       | string | yes      | Raw sender (name + email or bare email) |
| `subject`    | string | yes      | Email subject line                      |
| `body`       | string | yes      | Plain-text email body                   |
| `receivedAt` | string | no       | RFC 2822 / ISO 8601 date header         |

### Output

```json
{
  "success": true,
  "senderName": "Jane Doe",
  "senderEmail": "jane@acmecorp.com",
  "company": "acmecorp",
  "intent": "demo request",
  "urgency": "medium",
  "intentSignals": ["I'm looking for a sales automation tool"],
  "parsedAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample inbound lead email
- `fixtures/output.json` -- expected parsed output

## Testing

```bash
pnpm vitest run skills/parse-inbound-lead-email/tests/index.test.ts
```

## Failure Modes

- **Missing from field** -- returns `{ success: false, error: "Missing or invalid 'from' field..." }`.
- **Missing body field** -- returns `{ success: false, error: "Missing or invalid 'body' field..." }`.
- **Free email provider** -- company field is null (gmail, yahoo, outlook, etc.).

## Status

Implementation includes local heuristic parsing. NLP/LLM-based intent extraction is marked as TODO for production use.
