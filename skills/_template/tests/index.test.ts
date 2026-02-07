/**
 * Tests for the skill.
 *
 * This file demonstrates the fixture-based testing pattern used by
 * Clawdbot skills. It loads sample input from fixtures/input.json,
 * runs the skill, and compares the result to fixtures/output.json.
 *
 * To run:
 *   pnpm vitest run skills/_template/tests/index.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SkillInput } from "../src/index.js";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load a JSON fixture file from the fixtures/ directory. */
function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

describe("my-skill", () => {
  it("produces expected output for sample input", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const expected = loadFixture("output.json");

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output).toEqual(expected);
  });

  it("returns an error when query is missing", async () => {
    // Pass an empty object to test validation
    const output = await execute({} as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
    expect(output.error).toContain("query");
  });

  it("returns an error when query is not a string", async () => {
    // Pass a non-string query to test type validation
    const output = await execute({ query: 123 } as unknown as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
  });
});
