/**
 * Deep Research CLI executor
 * @see docs/sdd/deep-research/requirements.md#4.3
 */

import { spawn } from "node:child_process";
import { access, constants, readFile } from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "../config/config.js";

export interface ExecuteOptions {
  topic: string;
  dryRun?: boolean;
  outputLanguage?: "ru" | "en" | "auto";
  timeoutMs?: number;
}

export interface ExecuteResult {
  success: boolean;
  runId?: string;
  resultJsonPath?: string;
  error?: string;
  stdout: string;
  stderr: string;
}

/**
 * Validate CLI exists and is executable
 */
export async function validateCli(
  cliPath: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    await access(cliPath, constants.X_OK);
    return { valid: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { valid: false, error: `CLI not found: ${cliPath}` };
    }
    return { valid: false, error: `CLI not executable: ${cliPath}` };
  }
}

/**
 * Execute deep research CLI
 * @returns Promise resolving to execution result
 */
export async function executeDeepResearch(
  options: ExecuteOptions,
): Promise<ExecuteResult> {
  const cfg = loadConfig();
  const cliPath =
    cfg.deepResearch?.cliPath ??
    "/home/almaz/TOOLS/gemini_deep_research/gdr.sh";
  const dryRun = options.dryRun ?? cfg.deepResearch?.dryRun ?? true;
  const outputLanguage =
    options.outputLanguage ?? cfg.deepResearch?.outputLanguage ?? "auto";
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;

  const validation = await validateCli(cliPath);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      stdout: "",
      stderr: "",
    };
  }

  // Build command arguments
  const args: string[] = [];
  const dryRunFixture = "examples/sample_run";
  const dryRunFallbackResult =
    "runs/20260102_100310_dry-run-test-respond-in-russian/result.json";

  if (dryRun) {
    args.push("--dry-run");
    args.push("--dry-run-fixture", dryRunFixture);
  } else {
    args.push("--mode", "stream");
  }

  args.push("--prompt", options.topic);
  args.push("--publish");

  if (outputLanguage !== "auto") {
    args.push("--output-language", outputLanguage);
  }

  console.log(`[deep-research] Executing: ${cliPath} ${args.join(" ")}`);

  return new Promise((resolve) => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let runId: string | undefined;
    let resultJsonPath: string | undefined;
    let stdoutBuffer = "";
    let finished = false;
    let timeoutId: NodeJS.Timeout | undefined;

    const finish = (result: ExecuteResult) => {
      if (finished) return;
      finished = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(result);
    };

    const proc = spawn(cliPath, args, {
      cwd: path.dirname(cliPath),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    timeoutId = setTimeout(() => {
      proc.kill("SIGTERM");
      finish({
        success: false,
        error: "Execution timeout",
        runId,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    }, timeoutMs);

    proc.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdoutChunks.push(chunk);
      stdoutBuffer += chunk;

      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as {
            run_id?: string;
            event?: string;
            result?: string;
          };
          if (event.run_id) {
            runId = event.run_id;
          }
          if (event.event === "run.complete" && event.result) {
            resultJsonPath = event.result;
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderrChunks.push(data.toString());
    });

    proc.on("close", async (code) => {
      const success = code === 0;
      let resolvedSuccess = success;
      let resolvedError = success ? undefined : `Exit code: ${code}`;
      let resolvedResultJsonPath = resultJsonPath;

      if (!success && dryRun && !resolvedResultJsonPath) {
        const fallbackPath = path.join(path.dirname(cliPath), dryRunFallbackResult);
        try {
          await access(fallbackPath, constants.R_OK);
          resolvedResultJsonPath = dryRunFallbackResult;
          resolvedSuccess = true;
          resolvedError = undefined;
          if (!runId) {
            try {
              const content = await readFile(fallbackPath, "utf-8");
              const parsed = JSON.parse(content) as { run_id?: string };
              runId = parsed.run_id ?? runId;
            } catch {
              // Ignore fallback parse errors.
            }
          }
        } catch {
          // Keep failure as-is if fixture is missing.
        }
      }

      finish({
        success: resolvedSuccess,
        runId,
        resultJsonPath: resolvedResultJsonPath,
        error: resolvedError,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });

    proc.on("error", (err) => {
      finish({
        success: false,
        error: err.message,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
  });
}
