# generate-support-response

Generate a draft support response based on triage classification and knowledge base context.

BIZ-029 to BIZ-032 (#121-#124)

## What It Does

Given triage data from a support email, this skill:

- **Generates a personalized response** with appropriate tone and empathy level
- **Adapts content** to the ticket category (billing, technical, account, feature-request)
- **Suggests KB articles** relevant to the customer's issue
- **Recommends escalation** for critical/high-priority angry tickets
- **Produces internal agent notes** with priority guidance and handling tips

Supports three tone settings: empathetic (default), professional, and concise.

## Manifest

See `manifest.yaml` for permissions and configuration. This skill uses the `email-runner` tool and requires human approval before sending.

## Usage

### Input

```json
{
  "customerName": "John Smith",
  "customerEmail": "john@acmecorp.com",
  "originalSubject": "API integration not working",
  "originalBody": "Our API integration stopped working...",
  "category": "technical",
  "subCategory": "integration",
  "priority": "critical",
  "sentiment": "angry",
  "agentName": "Sarah Chen",
  "tone": "empathetic",
  "ticketId": "TKT-001"
}
```

| Field             | Type   | Required | Description                                   |
| ----------------- | ------ | -------- | --------------------------------------------- |
| `customerName`    | string | yes      | Customer's display name                       |
| `customerEmail`   | string | yes      | Customer's email address                      |
| `originalSubject` | string | yes      | Original email subject                        |
| `originalBody`    | string | yes      | Original email body                           |
| `category`        | string | yes      | Triage category                               |
| `subCategory`     | string | yes      | Triage sub-category                           |
| `priority`        | string | yes      | "low", "medium", "high", or "critical"        |
| `sentiment`       | string | yes      | "positive", "neutral", "negative", or "angry" |
| `agentName`       | string | yes      | Support agent name for signature              |
| `tone`            | string | no       | "empathetic", "professional", or "concise"    |
| `ticketId`        | string | no       | Ticket/case ID to include in subject          |

### Output

```json
{
  "success": true,
  "subject": "Re: API integration not working [TKT-001]",
  "body": "Hi John Smith,\n\nI completely understand your frustration...",
  "internalNote": "ESCALATION RECOMMENDED...",
  "suggestedArticles": [
    { "title": "API Integration Guide", "url": "https://docs.openclaw.ai/api/integration-guide" }
  ],
  "shouldEscalate": true,
  "generatedAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample critical enterprise support ticket
- `fixtures/output.json` -- expected response with escalation

## Testing

```bash
pnpm vitest run skills/generate-support-response/tests/index.test.ts
```

## Failure Modes

- **Missing customerName** -- returns error.
- **Missing originalBody** -- returns error.
- **Unknown category** -- falls back to generic response with help center link.

## Status

Template-based response generation with keyword-matched KB articles. LLM-powered personalized responses and real knowledge base integration are marked as TODO for production use.
