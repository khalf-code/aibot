/**
 * TOOLS-001 (#37) -- CLI runner
 *
 * Executes shell commands in a controlled sandbox with configurable timeouts,
 * environment variables, and working directories. All commands are validated
 * against the CLI allowlist before execution.
 *
 * @see ./cli-allowlist.ts for the allowlist gate
 * @see ./cli-parser.ts for output parsing utilities
 * @module
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Configuration for a single CLI command invocation. */
export type CliRunnerOptions = {
  /** The command to execute (e.g. `"git"`, `"ls"`, `"curl"`). */
  command: string;

  /** Arguments passed to the command. */
  args: string[];

  /**
   * Working directory for the child process.
   * Defaults to the current working directory when omitted.
   */
  cwd?: string;

  /**
   * Maximum time in milliseconds the command may run before being killed.
   * Defaults to 30 000 ms when omitted.
   */
  timeout_ms?: number;

  /**
   * Additional environment variables merged into the child process env.
   * Keys present here override inherited values.
   */
  env?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Captured output from a completed CLI invocation. */
export type CliRunnerResult = {
  /** Contents of stdout (UTF-8). */
  stdout: string;

  /** Contents of stderr (UTF-8). */
  stderr: string;

  /** Process exit code (`0` typically means success). */
  exit_code: number;

  /** Wall-clock duration of the execution in milliseconds. */
  duration_ms: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default timeout applied when `CliRunnerOptions.timeout_ms` is omitted. */
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Executes CLI commands in a child process and captures their output.
 *
 * Usage:
 * ```ts
 * const runner = new CliRunner();
 * const result = await runner.execute({
 *   command: "git",
 *   args: ["status", "--short"],
 *   cwd: "/path/to/repo",
 *   timeout_ms: 10_000,
 * });
 * ```
 */
export class CliRunner {
  /**
   * Execute a shell command and return its captured output.
   *
   * The implementation should:
   * 1. Validate the command against the CLI allowlist.
   * 2. Spawn a child process with the given options.
   * 3. Capture stdout and stderr.
   * 4. Kill the process if it exceeds `timeout_ms`.
   * 5. Return the result with timing information.
   *
   * @throws {Error} If the command is not on the allowlist.
   * @throws {Error} If the process cannot be spawned.
   */
  async execute(opts: CliRunnerOptions): Promise<CliRunnerResult> {
    const _timeout = opts.timeout_ms ?? DEFAULT_TIMEOUT_MS;

    // TODO: validate against CliAllowlist
    // TODO: spawn child process via node:child_process or Bun.spawn
    // TODO: capture stdout/stderr, enforce timeout, record duration

    void _timeout;

    throw new Error(
      `CliRunner.execute not implemented (command: "${opts.command} ${opts.args.join(" ")}")`,
    );
  }
}
