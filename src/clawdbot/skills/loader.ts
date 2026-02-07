/**
 * SK-002 (#28) -- Skill loader and sandbox runner
 *
 * Loads a skill from the `skills/` directory, parses its manifest, and
 * provides a sandboxed execution environment with mocked tool runners.
 */

import type { ManifestV1 } from "./manifest-schema.ts";

// ---------------------------------------------------------------------------
// LoadedSkill
// ---------------------------------------------------------------------------

/** A skill that has been resolved, validated, and is ready to execute. */
export interface LoadedSkill {
  /** The validated manifest for this skill. */
  manifest: ManifestV1;
  /** The skill's entry-point execute function. */
  execute: (input: unknown) => Promise<unknown>;
  /** Additional metadata resolved at load time. */
  metadata: {
    /** Absolute path to the skill directory on disk. */
    skillDir: string;
    /** ISO-8601 timestamp of when the skill was loaded. */
    loadedAt: string;
  };
}

// ---------------------------------------------------------------------------
// SkillLoader
// ---------------------------------------------------------------------------

/**
 * Resolves and loads skills from the local `skills/` directory tree.
 *
 * The loader is responsible for:
 *   1. Locating the skill directory by name.
 *   2. Parsing and validating `manifest.yaml`.
 *   3. Dynamically importing the skill's entry-point module.
 *   4. Returning a `LoadedSkill` handle the runtime can execute.
 */
export class SkillLoader {
  constructor(
    /** Root directory containing all skill subdirectories (typically `<repo>/skills`). */
    private readonly skillsRoot: string,
  ) {}

  /**
   * Load a skill by name.
   *
   * @param skillName - The directory name under `skillsRoot` (e.g. `"enrich-lead-website"`).
   * @returns A `LoadedSkill` ready for execution.
   * @throws If the skill directory, manifest, or entry point is missing or invalid.
   */
  async load(skillName: string): Promise<LoadedSkill> {
    const skillDir = `${this.skillsRoot}/${skillName}`;

    // TODO: read and parse manifest.yaml from skillDir
    // TODO: validate manifest via validateManifest()
    // TODO: dynamically import src/index.ts and extract execute()

    throw new Error(`SkillLoader.load not implemented (skill: "${skillName}", dir: "${skillDir}")`);
  }
}

// ---------------------------------------------------------------------------
// SandboxRunner
// ---------------------------------------------------------------------------

/** Result of a sandboxed skill execution. */
export type SandboxResult = {
  /** The output returned by the skill's execute function. */
  output: unknown;
  /** Tool calls intercepted by the sandbox (tool name + arguments). */
  interceptedCalls: Array<{ tool: string; args: unknown }>;
  /** Wall-clock duration of the execution in milliseconds. */
  durationMs: number;
};

/**
 * Runs a loaded skill inside a sandboxed environment.
 *
 * The sandbox intercepts tool-runner calls so skills can be tested
 * without real side effects (no network, no file writes, no emails).
 * This is the execution mode used by the test harness and CI.
 */
export class SandboxRunner {
  /** Tool calls recorded during the most recent run. */
  private interceptedCalls: Array<{ tool: string; args: unknown }> = [];

  /**
   * Create a mocked tool function that records calls instead of executing them.
   *
   * @param toolName - Name of the tool being mocked (e.g. `"browser-runner"`).
   * @returns A function that can replace the real tool runner.
   */
  mockTool(toolName: string): (...args: unknown[]) => Promise<unknown> {
    return async (...args: unknown[]): Promise<unknown> => {
      this.interceptedCalls.push({ tool: toolName, args });
      // Return a neutral placeholder -- real tool output is not available in sandbox mode.
      return { mocked: true, tool: toolName };
    };
  }

  /**
   * Execute a loaded skill inside the sandbox.
   *
   * @param skill - The loaded skill to run.
   * @param input - The input payload to pass to the skill.
   * @returns The sandbox result including output and intercepted calls.
   */
  async run(skill: LoadedSkill, input: unknown): Promise<SandboxResult> {
    this.interceptedCalls = [];
    const start = Date.now();

    // TODO: inject mocked tools into the skill's execution context
    // TODO: enforce timeout_ms from the manifest
    const output = await skill.execute(input);

    const durationMs = Date.now() - start;
    return {
      output,
      interceptedCalls: [...this.interceptedCalls],
      durationMs,
    };
  }
}
