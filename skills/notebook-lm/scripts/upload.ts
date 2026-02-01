#!/usr/bin/env bun

import { chromium, type Page } from "playwright";
import { resolve } from "path";
import { existsSync } from "fs";
import { expandHome, requireSecureProfile, logAccess } from "./security.js";

type Config = {
  user_data_dir?: string;
  default_notebook_url?: string;
  upload_timeout_ms?: number;
};

type Args = {
  notebookUrl?: string;
  filePath?: string;
  text?: string;
  title?: string;
};

const DEFAULT_USER_DATA_DIR = "~/.config/moltbot/notebook-lm-chrome";
const DEFAULT_UPLOAD_TIMEOUT_MS = 60000;
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

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    const value = rawValue ?? argv[index + 1];

    if (!rawValue) {
      index += 1;
    }

    switch (key) {
      case "notebook-url":
        args.notebookUrl = value;
        break;
      case "file":
        args.filePath = value;
        break;
      case "text":
        args.text = value;
        break;
      case "title":
        args.title = value;
        break;
      default:
        throw new Error(`Unknown argument: --${key}`);
    }
  }
  return args;
}

function usage(): string {
  return "Usage: upload.ts --notebook-url=URL --file=PATH | --text=CONTENT [--title=TITLE]";
}

async function clickAddSource(page: Page, timeoutMs: number): Promise<void> {
  const addSourceButton = page.getByRole("button", { name: /add source|add sources|add a source/i }).first();
  if ((await addSourceButton.count()) > 0) {
    await addSourceButton.click({ timeout: timeoutMs });
    return;
  }

  const addSourceText = page.getByText(/add source|add sources|add a source/i).first();
  if ((await addSourceText.count()) > 0) {
    await addSourceText.click({ timeout: timeoutMs });
    return;
  }

  throw new Error("Unable to find the 'Add source' button.");
}

async function waitForProcessing(page: Page, timeoutMs: number): Promise<void> {
  const processing = page.getByText(/processing/i).first();
  try {
    await processing.waitFor({ state: "visible", timeout: 5000 });
    await processing.waitFor({ state: "hidden", timeout: timeoutMs });
    return;
  } catch {
    await page.waitForLoadState("networkidle", { timeout: Math.min(10000, timeoutMs) });
  }
}

async function uploadFile(page: Page, filePath: string, timeoutMs: number): Promise<void> {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: timeoutMs });
  await fileInput.setInputFiles(filePath);
}

async function uploadText(page: Page, text: string, title: string | undefined, timeoutMs: number): Promise<void> {
  const pasteButton = page.getByRole("button", { name: /paste text|text/i }).first();
  if ((await pasteButton.count()) > 0) {
    await pasteButton.click({ timeout: timeoutMs });
  }

  const textArea = page.locator("textarea").first();
  if ((await textArea.count()) > 0) {
    await textArea.fill(text);
  } else {
    const contentEditable = page.locator('[contenteditable="true"]').first();
    await contentEditable.fill(text);
  }

  if (title) {
    const titleLabel = page.getByLabel(/title/i).first();
    if ((await titleLabel.count()) > 0) {
      await titleLabel.fill(title);
    } else {
      const titlePlaceholder = page.getByPlaceholder(/title/i).first();
      if ((await titlePlaceholder.count()) > 0) {
        await titlePlaceholder.fill(title);
      }
    }
  }

  const addButton = page.getByRole("button", { name: /add source|add|insert|save|done/i }).first();
  if ((await addButton.count()) > 0) {
    await addButton.click({ timeout: timeoutMs });
  }
}

async function main() {
  const config = await loadConfig();
  const args = parseArgs(process.argv.slice(2));

  const notebookUrl = args.notebookUrl ?? config.default_notebook_url;
  if (!notebookUrl) {
    throw new Error("Missing --notebook-url and no default_notebook_url configured.");
  }

  if ((args.filePath && args.text) || (!args.filePath && !args.text)) {
    throw new Error("Provide exactly one of --file or --text.");
  }

  const userDataDir = expandHome(config.user_data_dir ?? DEFAULT_USER_DATA_DIR);
  if (!existsSync(resolve(userDataDir, "Default"))) {
    throw new Error(`Chrome profile not found at ${userDataDir}. Run 'notebook.sh auth' first.`);
  }

  requireSecureProfile(userDataDir, "upload");

  const uploadTimeoutMs = config.upload_timeout_ms ?? DEFAULT_UPLOAD_TIMEOUT_MS;
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(notebookUrl, { waitUntil: "domcontentloaded" });
  await clickAddSource(page, uploadTimeoutMs);

  if (args.filePath) {
    const resolvedPath = resolve(args.filePath);
    const file = Bun.file(resolvedPath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${resolvedPath}`);
    }
    await uploadFile(page, resolvedPath, uploadTimeoutMs);
  }

  if (args.text) {
    await uploadText(page, args.text, args.title, uploadTimeoutMs);
  }

  await waitForProcessing(page, uploadTimeoutMs);
  await context.close();

  logAccess({
    action: "upload",
    profilePath: userDataDir,
    success: true,
  });

  console.log("Upload completed.");
}

main().catch((error) => {
  console.error("Upload failed:", error instanceof Error ? error.message : error);
  console.error(usage());
  process.exit(1);
});
