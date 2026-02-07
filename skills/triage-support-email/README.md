# triage-support-email

Triage an inbound support email by classifying category, priority, sentiment, and suggested routing.

BIZ-025 to BIZ-028 (#117-#120)

## What It Does

Given a raw support email, this skill:

- **Classifies category** (billing, technical, account, feature-request, general) and sub-category
- **Determines priority** (low, medium, high, critical) based on content, sentiment, and customer tier
- **Detects sentiment** (positive, neutral, negative, angry)
- **Suggests routing** to the appropriate support queue/team
- **Extracts topics** for tagging and search
- **Flags churn risk** when cancellation/switching signals are detected

## Manifest

See `manifest.yaml` for permissions and configuration. This skill uses the `email-runner` tool and requires no secrets or domain access.

## Usage

### Input

```json
{
  "from": "John Smith <john@acmecorp.com>",
  "subject": "API integration not working",
  "body": "Our API integration stopped working after the update...",
  "customerTier": "enterprise"
}
```

| Field              | Type   | Required | Description                      |
| ------------------ | ------ | -------- | -------------------------------- |
| `from`             | string | yes      | Raw sender (name + email)        |
| `subject`          | string | yes      | Email subject line               |
| `body`             | string | yes      | Plain-text email body            |
| `existingTicketId` | string | no       | Existing ticket ID (for replies) |
| `customerTier`     | string | no       | "free", "pro", or "enterprise"   |

### Output

```json
{
  "success": true,
  "category": "technical",
  "subCategory": "integration",
  "priority": "critical",
  "sentiment": "angry",
  "suggestedRoute": "integrations-team",
  "isReply": false,
  "topics": ["error", "api", "integration"],
  "churnRisk": false,
  "triagedAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample enterprise support email
- `fixtures/output.json` -- expected triage classification

## Testing

```bash
pnpm vitest run skills/triage-support-email/tests/index.test.ts
```

## Failure Modes

- **Missing from field** -- returns error.
- **Missing body field** -- returns error.
- **Ambiguous classification** -- falls back to "general/other" category.

## Status

Keyword-based heuristic classification. LLM-based classification and ticketing system integration (Zendesk, Freshdesk) are marked as TODO for production use.
