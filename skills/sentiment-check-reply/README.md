# sentiment-check-reply

> BIZ-041 to BIZ-044 (#133-#136)

Check the sentiment and tone of a drafted support reply before sending to the customer.

## What it does

Given a drafted reply and optional context (customer message, priority, frustration flag), this skill:

1. Computes an overall sentiment score (-1.0 to 1.0) and label (positive/neutral/negative).
2. Evaluates tone aspects: empathy, formality, clarity, urgency, frustration.
3. Scans for problematic phrases (blaming, condescending, dismissive language).
4. Returns a recommended action: send, revise, or escalate to a reviewer.

## Directory layout

```
manifest.yaml          Permissions, metadata, and runtime configuration.
src/index.ts           Skill implementation. Exports an execute() function.
tests/index.test.ts    Vitest tests using fixture-based assertions.
fixtures/input.json    Sample input: mixed-tone reply to a frustrated customer.
fixtures/output.json   Expected output for the sample input.
README.md              This file.
```

## Tone flags

| Severity | Meaning                                       | Action          |
| -------- | --------------------------------------------- | --------------- |
| info     | Minor style suggestion                        | Optional fix    |
| warning  | Should be revised before sending              | Recommended fix |
| error    | Must be fixed; risks escalating the situation | Required fix    |

## Testing

```bash
pnpm vitest run skills/sentiment-check-reply/tests/index.test.ts
```

## Failure modes

- **Missing replyText** -- Returns `{ success: false }` with a validation error.
- **Very short reply** -- May produce low confidence scores; the skill still returns a result.
- **Multi-language replies** -- The current rule-based engine works best with English text.

## Observability

BIZ-044 (#136) adds the following metrics:

- `sentiment_check.analysis_total` -- Counter of analyses performed.
- `sentiment_check.flags_detected` -- Histogram of flag count per analysis.
- `sentiment_check.action_total` -- Counter labeled by recommended action (send/revise/escalate).
- `sentiment_check.analysis_latency_ms` -- Histogram of skill execution latency.
