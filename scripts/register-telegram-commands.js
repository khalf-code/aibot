import { Bot } from "grammy";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOME = process.env.HOME;
const configPath = path.join(HOME, ".clawdis", "clawdis.json");
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const token = cfg.telegram?.botToken;

if (!token) {
  console.log("No Telegram token found, skipping");
  process.exit(0);
}

const bot = new Bot(token);
const skillsDir = path.join(HOME, ".clawdis", "skills");
const sourceDir = path.join(HOME, "agents", "skills");
const SKILL_PREFIX = "skill_";
const MAX_COMMANDS = 100;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const systemCommandsPath = path.join(
  scriptDir,
  "..",
  "dist",
  "telegram",
  "system-commands.js",
);
if (!fs.existsSync(systemCommandsPath)) {
  console.error(
    "Missing dist/telegram/system-commands.js. Run `pnpm build` to sync Telegram commands.",
  );
  process.exit(1);
}
const { listTelegramSystemCommandsForRegistration } = await import(
  pathToFileURL(systemCommandsPath).href,
);

// System commands (auto-synced with Telegram bot handler)
const commands = listTelegramSystemCommandsForRegistration().slice(0, MAX_COMMANDS);

// Add skill commands (only those that sync to clawdis)
try {
  const dirs = fs.readdirSync(skillsDir);
  for (const dir of dirs) {
    if (commands.length >= MAX_COMMANDS) break;
    // Check if skill syncs to clawdis via sync.json in source dir
    const syncJsonPath = path.join(sourceDir, dir, "sync.json");
    if (fs.existsSync(syncJsonPath)) {
      const syncConfig = JSON.parse(fs.readFileSync(syncJsonPath, "utf8"));
      if (!syncConfig.targets?.includes("clawdis")) {
        continue; // Skip skills not targeting clawdis
      }
    }

    const skillPath = path.join(skillsDir, dir, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      const content = fs.readFileSync(skillPath, "utf8");
      const match = content.match(/shortDescription:\s*(.+)/);
      const desc = match ? match[1].trim() : "Run " + dir;
      // Telegram commands: lowercase, 1-32 chars, only a-z, 0-9, _
      const baseName = dir.toLowerCase().replace(/-/g, "_");
      const prefixed = `${SKILL_PREFIX}${baseName}`.slice(0, 32);
      if (/^[a-z0-9_]+$/.test(prefixed)) {
        if (commands.length < MAX_COMMANDS) {
          commands.push({
            command: prefixed,
            description: `Skill: ${desc.slice(0, 248)}`,
          });
        }
      }
    }
  }
} catch (e) {
  console.error("Error reading skills:", e.message);
}

bot.api
  .setMyCommands(commands)
  .then(() => {
    console.log(`Registered ${commands.length} Telegram commands`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("Failed to register commands:", e.message);
    process.exit(1);
  });
