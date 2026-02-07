---
summary: "Step-by-step guide to creating your first Clawdbot skill"
title: "Your First Skill"
---

# Your First Skill

This tutorial walks you through creating a Clawdbot skill from scratch. By the end, you will have a working skill with a manifest, implementation, tests, and fixtures -- ready to submit as a pull request.

## Prerequisites

- Node 22+ installed
- The OpenClaw repo cloned and dependencies installed (`pnpm install`)
- Familiarity with TypeScript basics

## What is a skill?

A skill is a small, composable unit of automation. Each skill does one thing well: scrape a website, enrich a lead, format a report, call an API. Skills declare their permissions up front via a manifest, and the Clawdbot runtime enforces those permissions at execution time.

Every skill lives under `skills/` and follows this structure:

```
skills/
  my-skill/
    manifest.yaml    # Permissions, metadata, configuration
    src/             # Implementation code
    tests/           # Test files
    fixtures/        # Sample inputs and expected outputs
    README.md        # Usage documentation
```

## Step 1: Copy the template

The repo includes a ready-made template at `skills/_template/`. Copy it and give your skill a name. Skill names use lowercase letters, digits, and hyphens only.

```bash
cp -r skills/_template skills/my-skill
```

Your new directory now contains:

```
skills/my-skill/
  manifest.yaml
  src/index.ts
  tests/index.test.ts
  fixtures/input.json
  fixtures/output.json
  README.md
```

## Step 2: Edit the manifest

Open `skills/my-skill/manifest.yaml`. The manifest tells Clawdbot what your skill needs and how it behaves. Every field is documented with comments in the template.

Here is what a completed manifest looks like for a skill that scrapes a website:

```yaml
name: enrich-lead-website
version: 1.0.0
description: Scrape a lead's website and extract company name, tagline, and key pages.

permissions:
  tools:
    - browser-runner # Needs Playwright to load pages
  secrets: [] # No API keys needed
  domains:
    - "*" # Needs open web access

approval_required: false # No human approval for read-only scraping
timeout_ms: 30000 # 30-second timeout
```

Key fields to update:

- **name** -- Must match the directory name. Use `lowercase-with-hyphens`.
- **version** -- Start at `1.0.0`. Bump when you change behavior.
- **description** -- One sentence explaining what the skill does. Be specific.
- **permissions.tools** -- Which tool runners the skill needs. Common values: `cli-runner`, `browser-runner`, `email-runner`.
- **permissions.secrets** -- Any secret names the skill reads from the vault (e.g., `OPENAI_API_KEY`). Use an empty list if none.
- **permissions.domains** -- Which domains the skill can access. Use `"*"` for open access, or list specific domains.
- **approval_required** -- Set to `true` if the skill performs commit-step actions (sending emails, submitting forms, making payments).
- **timeout_ms** -- Maximum execution time in milliseconds. Default is `30000` (30 seconds).

## Step 3: Implement the skill logic

Open `skills/my-skill/src/index.ts`. This is where your skill logic lives.

The template provides a skeleton with the `SkillInput` and `SkillOutput` types and the main `execute` function. Your job is to fill in the logic.

Here is an example implementation for a URL-title-extractor skill:

```typescript
import type { SkillInput, SkillOutput } from "./types.js";

/**
 * Extract the page title from a given URL.
 *
 * Input:  { "url": "https://example.com" }
 * Output: { "title": "Example Domain", "success": true }
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  const { url } = input;

  if (!url || typeof url !== "string") {
    return { success: false, error: "Missing or invalid 'url' in input" };
  }

  try {
    const response = await fetch(url);
    const html = await response.text();

    // Extract <title> content with a simple regex
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = match ? match[1].trim() : "No title found";

    return { title, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to fetch URL: ${message}` };
  }
}
```

Guidelines for implementation:

- **Keep it focused.** One skill = one job. If your logic does two unrelated things, split it into two skills.
- **Handle errors gracefully.** Return a structured error in the output rather than throwing. The runtime expects a `SkillOutput` object.
- **Use strict typing.** Avoid `any`. Define clear interfaces for your input and output shapes.
- **Add comments for non-obvious logic.** Future reviewers (human and AI) will thank you.

## Step 4: Write tests with fixtures

Clawdbot skills use a fixture-based testing pattern. You provide sample input JSON, run your skill, and compare the result against expected output JSON.

### 4a: Define your input fixture

Edit `skills/my-skill/fixtures/input.json` with a realistic sample input:

```json
{
  "url": "https://example.com"
}
```

### 4b: Define your expected output fixture

Edit `skills/my-skill/fixtures/output.json` with the expected result:

```json
{
  "title": "Example Domain",
  "success": true
}
```

### 4c: Write your test

Open `skills/my-skill/tests/index.test.ts`. The template includes a working test skeleton that loads fixtures and calls your `execute` function.

Here is what a completed test looks like:

```typescript
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string) {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

describe("my-skill", () => {
  it("produces expected output for sample input", async () => {
    const input = loadFixture("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    // Compare against the expected fixture
    const expected = loadFixture("output.json");
    expect(output).toEqual(expected);
  });

  it("returns an error for missing url", async () => {
    const output = await execute({});
    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
  });
});
```

Tips for writing good skill tests:

- **Test the happy path** using your fixtures. This is the minimum.
- **Test error cases.** What happens with missing fields, bad input, network failures?
- **Keep fixtures realistic.** Use data that resembles what the skill will see in production.
- **Name test files to match source files.** `src/index.ts` gets `tests/index.test.ts`.

## Step 5: Run tests locally

Run your skill tests using the project test runner:

```bash
pnpm test skills/my-skill
```

If you want to run just your test file directly with vitest:

```bash
pnpm vitest run skills/my-skill/tests/index.test.ts
```

Before submitting, also run the full project checks to make sure nothing is broken:

```bash
pnpm check    # Lint + format + type-check
pnpm build    # Full build
pnpm test     # All tests
```

Fix any lint or type errors before moving on.

## Step 6: Submit a PR for review

Once your tests pass and the checks are clean, you are ready to submit.

### 6a: Create a branch

```bash
git checkout -b feat/skill-my-skill
```

### 6b: Commit your changes

Use the project commit helper to keep staging scoped:

```bash
scripts/committer "skills: add my-skill" skills/my-skill
```

Or commit manually:

```bash
git add skills/my-skill
git commit -m "skills: add my-skill"
```

### 6c: Push and open a PR

```bash
git push -u origin feat/skill-my-skill
gh pr create --title "Skills: add my-skill" --body "## Summary
- Adds the my-skill skill for [description].

## Test plan
- [ ] Fixture-based tests pass: \`pnpm test skills/my-skill\`
- [ ] Full check passes: \`pnpm check && pnpm build && pnpm test\`
"
```

Read the full [Submitting a PR](/help/submitting-a-pr) guide for detailed expectations.

## What happens next

After you open your PR:

1. **CI runs.** Lint, type-check, build, and tests run automatically.
2. **Review.** A maintainer reviews your manifest permissions, implementation, and test coverage.
3. **Signing.** Approved skills are signed and added to the internal skill registry.
4. **Merge.** Your skill lands on `main` and becomes available to all Clawdbot users.

## Quick reference

| What                  | Where                                      |
| --------------------- | ------------------------------------------ |
| Skill template        | `skills/_template/`                        |
| Skills guide          | `docs/clawdbot/skills/guide.md`            |
| Safety model          | `docs/clawdbot/governance/safety-model.md` |
| Architecture overview | `docs/clawdbot/architecture/overview.md`   |
| PR guidelines         | `docs/help/submitting-a-pr.md`             |
| Test runner           | `pnpm test` (vitest)                       |
| Lint and format       | `pnpm check`                               |
