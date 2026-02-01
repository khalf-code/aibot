#!/usr/bin/env bun
import { chromium } from "playwright";
import { validateUrl } from "./validate-url";

type ScrapeResult = {
  title: string;
  content: string;
  links: string[];
};

const parseSelectorArg = (args: string[]): { url?: string; selector?: string } => {
  let url: string | undefined;
  let selector: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--selector=")) {
      selector = arg.split("=")[1];
      continue;
    }
    if (arg === "--selector") {
      selector = args[i + 1];
      i += 1;
      continue;
    }
    if (!url && !arg.startsWith("--")) {
      url = arg;
    }
  }

  return { url, selector };
};

const extractContent = async (page: import("playwright").Page, selector?: string) => {
  const selectors = selector ? [selector] : ["article", "main"];
  for (const item of selectors) {
    const handle = await page.$(item);
    if (!handle) continue;
    const text = await page.$eval(item, (el) => el.textContent ?? "");
    if (text.trim()) {
      return text.trim();
    }
  }

  return page.$eval("body", (el) => (el.textContent ?? "").trim());
};

const normalizeLinks = (hrefs: string[], baseUrl: string): string[] => {
  const unique = new Set<string>();
  for (const href of hrefs) {
    if (!href) continue;
    if (href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    try {
      const resolved = new URL(href, baseUrl).toString();
      unique.add(resolved);
    } catch {
      continue;
    }
  }
  return Array.from(unique);
};

const scrapePage = async (url: string, selector?: string): Promise<ScrapeResult> => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(url, { timeout: 30000, waitUntil: "networkidle" });
    const title = await page.title();
    const content = await extractContent(page, selector);
    const hrefs = await page.$$eval("a[href]", (elements) =>
      elements.map((el) => el.getAttribute("href") ?? "")
    );
    const links = normalizeLinks(hrefs, url);

    return { title, content, links };
  } finally {
    await page.close();
    await browser.close();
  }
};

const runCli = async () => {
  const { url, selector } = parseSelectorArg(process.argv.slice(2));
  if (!url) {
    console.error("Usage: bun run scrape-web.ts <url> [--selector=\"article\"]");
    process.exit(1);
  }

  const validation = await validateUrl(url);
  if (!validation.valid) {
    console.error(validation.error ?? "URL validation failed");
    process.exit(1);
  }

  try {
    const result = await scrapePage(url, selector);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scrape page";
    console.error(message);
    process.exit(1);
  }
};

if (import.meta.main) {
  runCli();
}
