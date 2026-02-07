# my-skill

> **Template skill** -- copy this directory to create a new skill.

## Quick start

```bash
# 1. Copy the template
cp -r skills/_template skills/your-skill-name

# 2. Rename "my-skill" references in manifest.yaml, tests, and this README

# 3. Implement your logic in src/index.ts

# 4. Update fixtures with realistic sample data

# 5. Run tests
pnpm vitest run skills/your-skill-name/tests/index.test.ts
```

## Directory layout

```
manifest.yaml      Permissions, metadata, and runtime configuration.
src/index.ts       Skill implementation. Exports an execute() function.
tests/index.test.ts  Vitest tests using fixture-based assertions.
fixtures/input.json  Sample input payload.
fixtures/output.json Expected output for the sample input.
README.md           This file. Replace with your skill's documentation.
```

## Manifest

See the comments in `manifest.yaml` for a description of every field.

## Testing

Tests use the [vitest](https://vitest.dev/) runner. The test file loads
fixtures from `fixtures/`, calls `execute()`, and compares the result.

```bash
# Run just this skill's tests
pnpm vitest run skills/your-skill-name/tests/index.test.ts

# Run all project tests
pnpm test
```

## Submitting

When your skill is ready, open a pull request. See the
[first-skill tutorial](../../docs/clawdbot/tutorials/first-skill.md) and
the [Submitting a PR](../../docs/help/submitting-a-pr.md) guide.

## Failure modes

Document known failure scenarios here so operators know what to expect:

- **Missing query field** -- Returns `{ success: false, error: "Missing or invalid 'query' in input." }`.
- **Network timeout** -- (Add your failure modes here.)
