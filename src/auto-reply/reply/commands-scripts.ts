import { exec, execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { callGateway } from "../../gateway/call.js";
import { logVerbose } from "../../globals.js";
import type { CommandHandler, CommandHandlerResult } from "./commands-types.js";

const execAsync = promisify(exec);

const CLAWD_DIR = "/home/azureuser/clawdbot-source";
const HOME = process.env.HOME || "/home/azureuser";

// Custom clawd-* commands that run shell scripts
const CLAWD_SCRIPT_COMMANDS: Record<string, { path: string; restart: boolean; args?: string }> = {
  // Git commands - new unified system
  "/git": { path: "~/clawd-scripts/git.sh", restart: false },
  "/gs": { path: "~/clawd-scripts/git-status.sh", restart: false },
  "/gl": { path: "~/clawd-scripts/git-log.sh", restart: false },
  "/gd": { path: "~/clawd-scripts/git-diff.sh", restart: false },
  "/stash": { path: "~/clawd-scripts/git-stash.sh", restart: false },
  "/unstash": { path: "~/clawd-scripts/git-unstash.sh", restart: false },
  "/sync": { path: "~/clawd-scripts/sync.sh", restart: false },
  
  // Existing commands
  "/update": { path: "~/clawd-scripts/update.sh", restart: true },
  "/restart": { path: "~/clawd-scripts/restart.sh", restart: true },
  "/revert": { path: "~/clawd-scripts/revert.sh", restart: true },
  "/push": { path: "~/clawd-scripts/push.sh", restart: false },
  "/git-status": { path: "~/clawd-scripts/git-status.sh", restart: false },
  "/doctor": { path: "~/clawd-scripts/doctor.sh", restart: false },
  "/logs": { path: "~/clawd-scripts/logs.sh", restart: false },
  "/crons": { path: "~/clawd-scripts/crons.sh", restart: false },
  "/copilot-models": { path: "~/clawd-scripts/models.sh", restart: false },
  
  // Legacy aliases (for backwards compatibility)
  "/clawd-update": { path: "~/clawd-scripts/update.sh", restart: true },
  "/clawd-restart": { path: "~/clawd-scripts/restart.sh", restart: true },
  "/clawd-revert": { path: "~/clawd-scripts/revert.sh", restart: true },
  "/clawd-push": { path: "~/clawd-scripts/push.sh", restart: false },
  "/clawd-git-status": { path: "~/clawd-scripts/git-status.sh", restart: false },
  "/clawd-doctor": { path: "~/clawd-scripts/doctor.sh", restart: false },
  "/clawd-logs": { path: "~/clawd-scripts/logs.sh", restart: false },
};

// Helper to strip ANSI codes
const stripAnsi = (str: string): string => str.replace(/\x1b\[[0-9;]*m/g, "");

export const handleScriptCommand: CommandHandler = async (
  params,
  allowTextCommands,
): Promise<CommandHandlerResult | null> => {
  const { command, ctx } = params;
  const scriptDef = CLAWD_SCRIPT_COMMANDS[command.commandBodyNormalized];

  if (!allowTextCommands || !scriptDef) {
    return null;
  }

  if (!command.isAuthorizedSender) {
    logVerbose(
      `Ignoring ${command.commandBodyNormalized} from unauthorized sender: ${command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const expandedPath = scriptDef.path.replace("~", HOME);
  const lockFile = "/tmp/clawd-command.lock";

  if (scriptDef.restart) {
    try {
      const stat = fs.statSync(lockFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 300000) {
        return {
          shouldContinue: false,
          reply: { text: "A restart operation is already in progress. Please wait." },
        };
      }
    } catch {
      /* lock file does not exist, proceed */
    }

    fs.writeFileSync(lockFile, `${command.commandBodyNormalized} started at ${new Date().toISOString()}`);

    try {
      const subprocess = spawn(expandedPath, [], {
        detached: true,
        stdio: "ignore",
      });
      subprocess.unref();
      return {
        shouldContinue: false,
        reply: { text: "Process initiated in background. You will receive a Telegram notification when complete." },
      };
    } catch {
      fs.unlinkSync(lockFile);
      return {
        shouldContinue: false,
        reply: { text: "Failed to spawn background process." },
      };
    }
  } else {
    try {
      const { stdout, stderr } = await execAsync(expandedPath, { timeout: 300000 });
      const output = (stdout + (stderr ? `\n${stderr}` : "")).trim();
      const cleanOutput = stripAnsi(output).slice(0, 4000);
      return {
        shouldContinue: false,
        reply: { text: cleanOutput || "Command completed (no output)." },
      };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      const errorOutput = (error.stdout || "") + (error.stderr || "") || error.message || "Unknown error";
      const cleanError = stripAnsi(errorOutput).slice(0, 4000);
      return {
        shouldContinue: false,
        reply: { text: `Command failed:\n${cleanError}` },
      };
    }
  }
};

// /gc <message> - Git commit command
export const handleGitCommitCommand: CommandHandler = async (
  params,
  allowTextCommands,
): Promise<CommandHandlerResult | null> => {
  const { command } = params;
  
  const match = command.commandBodyNormalized.match(/^\/gc\s+(.+)$/);
  if (!allowTextCommands || !match) {
    return null;
  }

  if (!command.isAuthorizedSender) {
    logVerbose(`Ignoring /gc from unauthorized sender: ${command.senderId || "<unknown>"}`);
    return { shouldContinue: false };
  }

  const commitMessage = match[1].trim();
  const scriptPath = `${HOME}/clawd-scripts/git-commit.sh`;

  try {
    const { stdout, stderr } = await execAsync(`"${scriptPath}" "${commitMessage}"`, { 
      timeout: 60000,
      cwd: CLAWD_DIR,
    });
    const output = (stdout + (stderr ? `\n${stderr}` : "")).trim();
    return {
      shouldContinue: false,
      reply: { text: stripAnsi(output).slice(0, 4000) || "Commit completed." },
    };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const errorOutput = (error.stdout || "") + (error.stderr || "") || error.message || "Unknown error";
    return {
      shouldContinue: false,
      reply: { text: `Commit failed:\n${stripAnsi(errorOutput).slice(0, 4000)}` },
    };
  }
};

// Branch switching commands (/branch, /main)
export const handleBranchCommand: CommandHandler = async (
  params,
  allowTextCommands,
): Promise<CommandHandlerResult | null> => {
  const { command, ctx } = params;
  
  const branchCommandMatch = command.commandBodyNormalized.match(/^\/branch(?:\s+(.+))?$/);
  const mainCommandMatch = command.commandBodyNormalized === "/main";

  if (!allowTextCommands || (!branchCommandMatch && !mainCommandMatch)) {
    return null;
  }

  if (!command.isAuthorizedSender) {
    logVerbose(
      `Ignoring branch command from unauthorized sender: ${command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const lockFile = "/tmp/clawdbot-branch-switch.lock";

  // Check for concurrent execution
  try {
    const stat = fs.statSync(lockFile);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 300000) {
      return {
        shouldContinue: false,
        reply: { text: "A branch switch is already in progress. Please wait." },
      };
    }
  } catch {
    /* lock file does not exist, proceed */
  }

  const chatId = ctx.OriginatingTo || ctx.SenderId || "";
  
  let currentBranch = "main";
  try {
    currentBranch = execSync(`git -C ${CLAWD_DIR} rev-parse --abbrev-ref HEAD`, {
      encoding: "utf8",
    }).trim();
  } catch {
    currentBranch = "main";
  }

  if (mainCommandMatch) {
    if (currentBranch === "main") {
      return {
        shouldContinue: false,
        reply: { text: "Already on `main` branch." },
      };
    }

    const subprocess = spawn(
      "/home/azureuser/clawdbot-branch-switch.sh",
      ["main", chatId, currentBranch],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    subprocess.unref();

    return {
      shouldContinue: false,
      reply: { text: "Switching to `main` branch. I'll notify you when complete." },
    };
  }

  if (branchCommandMatch) {
    const targetBranch = branchCommandMatch[1]?.trim();

    if (!targetBranch) {
      // Show current branch
      return {
        shouldContinue: false,
        reply: {
          text: `Current branch: \`${currentBranch}\`\n\nUsage:\n- \`/branch <name>\` - switch to branch\n- \`/main\` - switch to main branch`,
        },
      };
    }

    const subprocess = spawn(
      "/home/azureuser/clawdbot-branch-switch.sh",
      [targetBranch, chatId, currentBranch],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    subprocess.unref();

    return {
      shouldContinue: false,
      reply: { text: `Switching to branch \`${targetBranch}\`. I'll notify you when complete.` },
    };
  }

  return null;
};

// /handle-merge - AI-assisted merge conflict resolution
export const handleMergeCommand: CommandHandler = async (
  params,
  allowTextCommands,
): Promise<CommandHandlerResult | null> => {
  const { command, ctx, cfg } = params;

  if (!allowTextCommands || command.commandBodyNormalized !== "/handle-merge") {
    return null;
  }

  if (!command.isAuthorizedSender) {
    logVerbose(`Ignoring /handle-merge from unauthorized sender: ${command.senderId || "<unknown>"}`);
    return { shouldContinue: false };
  }

  // Check if we're in a merge state
  const mergeHeadPath = path.join(CLAWD_DIR, ".git", "MERGE_HEAD");
  if (!fs.existsSync(mergeHeadPath)) {
    return {
      shouldContinue: false,
      reply: { text: "No merge conflict detected. Run /sync or /update first." },
    };
  }

  // Get conflicted files
  let conflictedFiles: string[] = [];
  try {
    const result = execSync(`git -C ${CLAWD_DIR} diff --name-only --diff-filter=U`, {
      encoding: "utf8",
    }).trim();
    conflictedFiles = result ? result.split("\n").filter(Boolean) : [];
  } catch {
    return {
      shouldContinue: false,
      reply: { text: "Error checking for conflicts. Try again or resolve via SSH." },
    };
  }

  if (conflictedFiles.length === 0) {
    // Merge in progress but no file conflicts - just commit
    try {
      execSync(`git -C ${CLAWD_DIR} commit --no-edit`, { encoding: "utf8" });
      return {
        shouldContinue: false,
        reply: { text: "Merge completed successfully (no file conflicts)." },
      };
    } catch (err) {
      return {
        shouldContinue: false,
        reply: { text: "Error completing merge. Resolve via SSH." },
      };
    }
  }

  if (conflictedFiles.length > 3) {
    return {
      shouldContinue: false,
      reply: {
        text: `Too many conflicts (${conflictedFiles.length} files). Manual resolution required via SSH.\n\nConflicted files:\n${conflictedFiles.map(f => `- ${f}`).join("\n")}\n\nTo abort: git merge --abort`,
      },
    };
  }

  // Process each conflicted file with AI
  const results: string[] = [];
  let successCount = 0;

  for (const file of conflictedFiles) {
    const filePath = path.join(CLAWD_DIR, file);
    let fileContent: string;
    
    try {
      fileContent = fs.readFileSync(filePath, "utf8");
    } catch {
      results.push(`[${file}] Failed to read file`);
      continue;
    }

    // Check if it has conflict markers
    if (!fileContent.includes("<<<<<<<") || !fileContent.includes(">>>>>>>")) {
      results.push(`[${file}] No conflict markers found`);
      continue;
    }

    // Create AI prompt for conflict resolution
    const prompt = `You are resolving a git merge conflict. The file "${file}" has conflicts.

IMPORTANT RULES:
1. If the upstream (origin/main) changes are purely additive and don't conflict with user changes, merge both.
2. If the upstream overwrites user's custom changes, PRESERVE THE USER'S CHANGES. The user's customizations take priority.
3. If both sides have legitimate changes that can coexist, combine them intelligently.
4. Remove all conflict markers (<<<<<<<, =======, >>>>>>>) from the output.
5. Output ONLY the resolved file content, nothing else. No explanations.

Here is the file with conflicts:

\`\`\`
${fileContent}
\`\`\`

Output the fully resolved file content:`;

    try {
      // Call the AI to resolve
      const response = await callGateway({
        method: "agent",
        params: {
          message: prompt,
          sessionKey: `merge-resolve-${Date.now()}`,
          deliver: false,
          channel: "internal",
          lane: "nested",
          extraSystemPrompt: "You are a git merge conflict resolver. Output only code, no explanations.",
        },
        timeoutMs: 60000,
      }) as { runId?: string };

      // Wait for completion
      const runId = response?.runId;
      if (runId) {
        await callGateway({
          method: "agent.wait",
          params: { runId, timeoutMs: 55000 },
          timeoutMs: 60000,
        });

        // Get the response
        const history = await callGateway({
          method: "chat.history",
          params: { sessionKey: `merge-resolve-${Date.now()}`, limit: 5 },
        }) as { messages?: Array<{ role?: string; content?: string }> };

        const assistantMsg = history?.messages?.find(m => m.role === "assistant");
        if (assistantMsg?.content) {
          let resolved = assistantMsg.content;
          
          // Strip markdown code blocks if present
          const codeBlockMatch = resolved.match(/```(?:\w+)?\n?([\s\S]*?)```/);
          if (codeBlockMatch) {
            resolved = codeBlockMatch[1];
          }
          
          // Validate - should not have conflict markers
          if (resolved.includes("<<<<<<<") || resolved.includes(">>>>>>>")) {
            results.push(`[${file}] AI did not resolve all conflicts`);
            continue;
          }

          // Write resolved content
          fs.writeFileSync(filePath, resolved);
          execSync(`git -C ${CLAWD_DIR} add "${file}"`, { encoding: "utf8" });
          results.push(`[${file}] Resolved`);
          successCount++;
        } else {
          results.push(`[${file}] AI returned no response`);
        }
      } else {
        results.push(`[${file}] Failed to start AI resolution`);
      }
    } catch (err) {
      results.push(`[${file}] AI error: ${String(err).slice(0, 100)}`);
    }
  }

  // If all resolved, complete the merge
  if (successCount === conflictedFiles.length) {
    try {
      execSync(`git -C ${CLAWD_DIR} commit --no-edit`, { encoding: "utf8" });
      const newHead = execSync(`git -C ${CLAWD_DIR} rev-parse --short HEAD`, { encoding: "utf8" }).trim();
      
      return {
        shouldContinue: false,
        reply: {
          text: `Merge completed successfully!\n\n${results.join("\n")}\n\nNew HEAD: ${newHead}\n\nRun /push to upload to your fork.`,
        },
      };
    } catch (err) {
      return {
        shouldContinue: false,
        reply: {
          text: `Files resolved but commit failed:\n\n${results.join("\n")}\n\nTry: git commit --no-edit via SSH`,
        },
      };
    }
  }

  return {
    shouldContinue: false,
    reply: {
      text: `Partial resolution (${successCount}/${conflictedFiles.length}):\n\n${results.join("\n")}\n\nResolve remaining conflicts via SSH.`,
    },
  };
};
