#!/usr/bin/env bun

import { existsSync } from "fs";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "fs/promises";
import path from "path";

declare global {
  interface ImportMeta {
    dir: string;
  }
}

declare const Bun: any;

type CalendarEvent = {
  title?: string;
  time?: string;
  location?: string;
};

type Config = {
  obsidian_vault?: string;
  daily_folder?: string;
  calendar_script?: string;
  newsletter_output?: string;
  web_scraper_output?: string;
  filename_format?: string;
};

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const skillDir = path.resolve(scriptDir, "..");
const configPath = path.join(skillDir, "references", "config.json");

const DEFAULT_CONFIG: Config = {
  obsidian_vault: "~/Dev/BrainFucked",
  daily_folder: "95-Daily",
  calendar_script: "~/moltbot/skills/calendar-schedule/scripts/get-today.sh",
  newsletter_output: "~/moltbot/output/newsletter-digest/",
  web_scraper_output: "~/moltbot/output/web-scraper/",
  filename_format: "{date}-daily.md",
};

const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const toKoreanDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = KOREAN_WEEKDAYS[date.getDay()] || "";
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
};

const toDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const expandHome = (inputPath?: string) => {
  if (!inputPath) return "";
  if (inputPath.startsWith("~/")) {
    const home = process.env.HOME || "";
    return path.join(home, inputPath.slice(2));
  }
  return inputPath;
};

const loadConfig = async (): Promise<Config> => {
  try {
    if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
    const raw = await readFile(configPath, "utf-8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Config) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
};

const runCalendar = (scriptPath: string): CalendarEvent[] => {
  try {
    if (!Bun || !Bun.spawnSync) return [];
    const result = Bun.spawnSync({
      cmd: [scriptPath, "--json"],
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) return [];
    const output = result.stdout.toString().trim();
    if (!output) return [];
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed as CalendarEvent[];
    return [];
  } catch {
    return [];
  }
};

const resolveDailyFiles = async (directory: string, date: string) => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const dateCompact = date.replace(/-/g, "");
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.includes(date) || name.includes(dateCompact))
      .map((name) => path.join(directory, name));
  } catch {
    return [] as string[];
  }
};

const readTextFile = async (filePath: string) => {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
};

const formatCalendarSection = (events: CalendarEvent[]) => {
  const header = "## 📅 오늘의 일정\n\n";
  if (!events.length) {
    return `${header}데이터 없음\n\n`;
  }

  const lines = events.map((event) => {
    const title = event.title || "";
    const time = event.time || "";
    const location = event.location || "";
    let line = time ? `- **${time}** - ${title}` : `- ${title}`;
    if (location) line += ` @ ${location}`;
    return line;
  });

  return `${header}${lines.join("\n")}\n\n`;
};

const formatNewsletterFromJson = (data: unknown) => {
  if (Array.isArray(data)) {
    const items = data
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const title = (item as { title?: string }).title || "";
        const summary = (item as { summary?: string }).summary || "";
        const url = (item as { url?: string }).url || "";
        if (!title && !summary && !url) return "";
        const label = title || url || "뉴스레터";
        return summary ? `- ${label}: ${summary}` : `- ${label}`;
      })
      .filter(Boolean);
    return items.join("\n");
  }

  if (data && typeof data === "object") {
    const title = (data as { title?: string }).title;
    const date = (data as { date?: string }).date;
    const keyPoints = (data as { key_points?: string[] }).key_points || [];
    const parts: string[] = [];
    if (title) parts.push(`- ${title}${date ? ` (${date})` : ""}`);
    if (keyPoints.length) {
      parts.push(...keyPoints.map((point) => `  - ${point}`));
    }
    return parts.join("\n");
  }

  return "";
};

const formatTextBlocks = (blocks: string[]) => {
  const cleaned = blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  if (!cleaned.length) return "데이터 없음";
  return cleaned.join("\n\n");
};

const formatSection = (title: string, content: string) => {
  return `## ${title}\n\n${content}\n\n`;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let output: string | null = null;
  for (const arg of args) {
    if (arg.startsWith("--output=")) {
      output = arg.split("=").slice(1).join("=");
    } else if (arg === "--output" || arg === "-o") {
      const idx = args.indexOf(arg);
      if (idx !== -1 && args[idx + 1]) {
        output = args[idx + 1];
      }
    }
  }
  return { output };
};

const ensureBackup = async (filePath: string) => {
  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) return;
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "")
      .replace("T", "-")
      .slice(0, 15);
    const backupPath = `${filePath}.bak-${timestamp}`;
    await rename(filePath, backupPath);
  } catch {
    return;
  }
};

const main = async () => {
  const { output } = parseArgs();
  const now = new Date();
  const dateKorean = toKoreanDate(now);
  const dateString = toDateString(now);
  const config = await loadConfig();

  const calendarScript = expandHome(config.calendar_script) || "";
  const newsletterDir = expandHome(config.newsletter_output);
  const webScraperDir = expandHome(config.web_scraper_output);

  const calendarEvents = calendarScript ? runCalendar(calendarScript) : [];

  const newsletterFiles = newsletterDir
    ? await resolveDailyFiles(newsletterDir, dateString)
    : [];
  const newsletterBlocks: string[] = [];
  for (const filePath of newsletterFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const content = await readTextFile(filePath);
    if (!content.trim()) continue;
    if (ext === ".json") {
      try {
        const json = JSON.parse(content);
        const formatted = formatNewsletterFromJson(json);
        if (formatted.trim()) newsletterBlocks.push(formatted);
      } catch {
        newsletterBlocks.push(content.trim());
      }
    } else {
      newsletterBlocks.push(content.trim());
    }
  }

  const webFiles = webScraperDir
    ? await resolveDailyFiles(webScraperDir, dateString)
    : [];
  const webBlocks: string[] = [];
  for (const filePath of webFiles) {
    const content = await readTextFile(filePath);
    if (content.trim()) webBlocks.push(content.trim());
  }

  const header = `# 🗓️ 데일리 리포트 - ${dateKorean}\n\n`;
  const calendarSection = formatCalendarSection(calendarEvents);
  const newsletterSection = formatSection(
    "📬 뉴스레터 요약",
    formatTextBlocks(newsletterBlocks)
  );
  const webSection = formatSection(
    "🌐 웹 스크랩",
    formatTextBlocks(webBlocks)
  );
  const todoSection = "## ✅ TODO\n\n";

  const document = [
    header,
    calendarSection,
    newsletterSection,
    webSection,
    todoSection,
  ].join("");

  if (output) {
    const expandedOutput = expandHome(output);
    if (!expandedOutput) {
      process.stderr.write("Invalid output path\n");
      process.exit(1);
    }
    const outputDir = path.dirname(expandedOutput);
    await mkdir(outputDir, { recursive: true });
    await ensureBackup(expandedOutput);
    await writeFile(expandedOutput, document, "utf-8");
    process.stderr.write(`Generated: ${expandedOutput}\n`);
  } else {
    process.stdout.write(document);
  }
};

await main();
