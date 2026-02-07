/**
 * Skill implementation stub.
 *
 * This is the entry point for your skill. The runtime calls `execute()`
 * with the input payload and expects a structured output in return.
 *
 * Steps to implement:
 *   1. Define your input/output shapes in the SkillInput and SkillOutput types.
 *   2. Fill in the execute() function with your skill logic.
 *   3. Handle errors gracefully -- return { success: false, error: "..." }
 *      instead of throwing.
 *   4. Add fixtures in fixtures/ and tests in tests/ to verify behavior.
 */

// ── Types ────────────────────────────────────────────────────────

/**
 * Input payload for this skill.
 * Replace these fields with whatever your skill needs.
 */
export interface SkillInput {
  /** Example: a URL to process, a name to look up, etc. */
  query: string;
  // Add more fields as needed:
  // limit?: number;
  // options?: Record<string, unknown>;
}

/**
 * Output payload returned by this skill.
 * Always include `success` so callers can branch on it.
 */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** Your result data. Replace with real fields. */
  result?: string;
  // Add more fields as needed:
  // items?: Array<{ name: string; value: string }>;
}

// ── Implementation ───────────────────────────────────────────────

/**
 * Execute the skill.
 *
 * @param input - The validated input payload.
 * @returns The skill output. Always return an object -- never throw.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  // 1. Validate input
  if (!input.query || typeof input.query !== "string") {
    return { success: false, error: "Missing or invalid 'query' in input." };
  }

  try {
    // 2. TODO: Replace this placeholder with your skill logic.
    //
    // Examples of what you might do here:
    //   - Fetch data from an API
    //   - Parse and transform input data
    //   - Run a computation
    //   - Call a tool runner (browser, CLI, email)
    //
    const result = `Processed: ${input.query}`;

    // 3. Return structured output
    return { success: true, result };
  } catch (err) {
    // 4. Catch and return errors -- do not throw
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
