#!/usr/bin/env bun

import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import {
  expandHome,
  setSecurePermissions,
  requireSecureProfile,
  logAccess,
} from "./security.js";

type Config = {
  auth_state_path?: string;
  user_data_dir?: string;
};

const DEFAULT_USER_DATA_DIR = "~/.config/moltbot/notebook-lm-chrome";
const NOTEBOOKLM_URL = "https://notebooklm.google.com/";

const configPath = resolve(import.meta.dir, "../references/config.json");

async function loadConfig(): Promise<Config> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    return {};
  }
  try {
    return (await file.json()) as Config;
  } catch {
    return {};
  }
}

function waitForEnter(): Promise<void> {
  return new Promise((resolvePromise) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      resolvePromise();
    });
  });
}

async function main() {
  const config = await loadConfig();
  const userDataDir = expandHome(config.user_data_dir ?? DEFAULT_USER_DATA_DIR);

  await mkdir(userDataDir, { recursive: true, mode: 0o700 });

  const permResult = setSecurePermissions(userDataDir);
  if (!permResult.success) {
    console.error(`Security warning: ${permResult.error}`);
  }

  const isFirstRun = !existsSync(resolve(userDataDir, "Default"));

  if (!isFirstRun) {
    requireSecureProfile(userDataDir, "auth");
  }

  // Use persistent context with real Chrome profile
  // This bypasses Google's bot detection since it's a real profile
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: "chrome", // Use real Chrome instead of Chromium
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const page = context.pages()[0] || (await context.newPage());

  if (isFirstRun) {
    console.log("First run - please complete Google login in the browser.");
    console.log("Your login will be saved for future runs.");
  } else {
    console.log("Opening NotebookLM with saved profile...");
  }
  console.log("\nPress Enter here when done to close the browser.");

  await page.goto(NOTEBOOKLM_URL, { waitUntil: "domcontentloaded" });
  await waitForEnter();

  await context.close();

  const finalPermResult = setSecurePermissions(userDataDir);
  if (!finalPermResult.success) {
    console.error(`Warning: Could not secure profile: ${finalPermResult.error}`);
  }

  logAccess({
    action: "auth",
    profilePath: userDataDir,
    success: true,
  });

  console.log(`\nProfile saved to ${userDataDir}`);
  console.log("Permissions secured (700).");
  console.log("You can now use 'notebook.sh upload' commands.");
}

main().catch((error) => {
  console.error("Auth setup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
