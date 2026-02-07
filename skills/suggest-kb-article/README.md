# suggest-kb-article

> BIZ-037 to BIZ-040 (#129-#132)

Analyze a support ticket and suggest the most relevant knowledge base articles.

## What it does

Given a ticket subject and body, this skill:

1. Extracts keywords from the combined text (stop-word removal, deduplication).
2. Scores each knowledge base article by keyword overlap.
3. Returns a ranked list of suggestions sorted by relevance score.

In production, the stub corpus is replaced by an API call to the organization's knowledge base search endpoint.

## Directory layout

```
manifest.yaml          Permissions, metadata, and runtime configuration.
src/index.ts           Skill implementation. Exports an execute() function.
tests/index.test.ts    Vitest tests using fixture-based assertions.
fixtures/input.json    Sample input: password/login-related ticket.
fixtures/output.json   Expected output for the sample input.
README.md              This file.
```

## Testing

```bash
pnpm vitest run skills/suggest-kb-article/tests/index.test.ts
```

## Failure modes

- **Missing subject** -- Returns `{ success: false }` with a validation error.
- **No matching articles** -- Returns `{ success: true, suggestions: [] }` (not an error).
- **KB API unreachable** -- When integrated with a live API, network errors are caught and returned as structured errors.

## Observability

BIZ-040 (#132) adds the following metrics:

- `suggest_kb.search_total` -- Counter of KB searches performed.
- `suggest_kb.suggestions_returned` -- Histogram of suggestions per request.
- `suggest_kb.zero_results_total` -- Counter of searches returning no matches.
- `suggest_kb.search_latency_ms` -- Histogram of skill execution latency.
