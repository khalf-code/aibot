# generate-follow-up-tasks

Generate structured follow-up tasks from a sales call summary or email thread to keep deals moving forward.

BIZ-021 to BIZ-024 (#113-#116)

## What It Does

Given a call summary and deal context, this skill:

- **Extracts action items** from free-form text using keyword heuristics
- **Assigns priorities** (low/medium/high) based on task type
- **Sets due dates** using business-day calculations
- **Categorizes tasks** into email, call, internal, document, or meeting
- Always generates a recap email task

## Manifest

See `manifest.yaml` for permissions and configuration. This skill is computation-only with no external tool, secret, or domain requirements.

## Usage

### Input

```json
{
  "summary": "Discussed pricing and demo requirements with lead...",
  "ownerName": "Alex Rivera",
  "leadName": "Jane Doe",
  "company": "Acme Corp",
  "dealStage": "discovery",
  "baseDate": "2026-02-07T00:00:00.000Z"
}
```

| Field       | Type   | Required | Description                                   |
| ----------- | ------ | -------- | --------------------------------------------- |
| `summary`   | string | yes      | Free-form text (call notes, email, recap)     |
| `ownerName` | string | yes      | Sales rep or task owner name                  |
| `leadName`  | string | yes      | Lead or contact name                          |
| `company`   | string | no       | Company name for context                      |
| `dealStage` | string | no       | Deal stage (discovery, proposal, negotiation) |
| `baseDate`  | string | no       | Base date for due-date calculation (ISO 8601) |

### Output

```json
{
  "success": true,
  "tasks": [
    {
      "title": "Send proposal to Jane Doe",
      "description": "Prepare and send the pricing proposal...",
      "owner": "Alex Rivera",
      "priority": "high",
      "dueDate": "2026-02-09",
      "category": "document"
    }
  ],
  "taskCount": 6,
  "generatedAt": "2026-02-07T12:00:00.000Z"
}
```

## Fixtures

- `fixtures/input.json` -- sample call summary with rich context
- `fixtures/output.json` -- expected generated tasks

## Testing

```bash
pnpm vitest run skills/generate-follow-up-tasks/tests/index.test.ts
```

## Failure Modes

- **Missing summary** -- returns error with empty tasks array.
- **Missing ownerName** -- returns error.
- **No keywords detected** -- still generates a recap email task.

## Status

Keyword-based heuristic extraction. LLM-powered task extraction and task-management integration (Asana/Jira/Trello) are marked as TODO for production use.
