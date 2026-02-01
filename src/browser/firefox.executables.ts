import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BrowserExecutable } from "./chrome.executables.js";

function exists(filePath: string) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function findFirstExecutable(candidates: Array<BrowserExecutable>): BrowserExecutable | null {
  for (const candidate of candidates) {
    if (exists(candidate.path)) {
      return candidate;
    }
  }
  return null;
}

export function findFirefoxExecutableMac(): BrowserExecutable | null {
  const home = os.homedir();
  const candidates: Array<BrowserExecutable> = [
    {
      kind: "firefox",
      path: "/Applications/Firefox.app/Contents/MacOS/firefox",
    },
    {
      kind: "firefox",
      path: path.join(home, "Applications/Firefox.app/Contents/MacOS/firefox"),
    },
    {
      kind: "firefox-nightly",
      path: "/Applications/Firefox Nightly.app/Contents/MacOS/firefox",
    },
    {
      kind: "firefox-nightly",
      path: path.join(home, "Applications/Firefox Nightly.app/Contents/MacOS/firefox"),
    },
    {
      kind: "firefox-dev",
      path: "/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox",
    },
    {
      kind: "firefox-dev",
      path: path.join(home, "Applications/Firefox Developer Edition.app/Contents/MacOS/firefox"),
    },
  ];
  return findFirstExecutable(candidates);
}

export function findFirefoxExecutableLinux(): BrowserExecutable | null {
  const candidates: Array<BrowserExecutable> = [
    { kind: "firefox", path: "/usr/bin/firefox" },
    { kind: "firefox", path: "/usr/bin/firefox-esr" },
    { kind: "firefox", path: "/snap/bin/firefox" },
    { kind: "firefox-dev", path: "/usr/bin/firefox-developer-edition" },
    { kind: "firefox-nightly", path: "/usr/bin/firefox-nightly" },
  ];
  return findFirstExecutable(candidates);
}

export function findFirefoxExecutableWindows(): BrowserExecutable | null {
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const joinWin = path.win32.join;

  const candidates: Array<BrowserExecutable> = [
    {
      kind: "firefox",
      path: joinWin(programFiles, "Mozilla Firefox", "firefox.exe"),
    },
    {
      kind: "firefox",
      path: joinWin(programFilesX86, "Mozilla Firefox", "firefox.exe"),
    },
    {
      kind: "firefox-nightly",
      path: joinWin(programFiles, "Firefox Nightly", "firefox.exe"),
    },
    {
      kind: "firefox-nightly",
      path: joinWin(programFilesX86, "Firefox Nightly", "firefox.exe"),
    },
    {
      kind: "firefox-dev",
      path: joinWin(programFiles, "Firefox Developer Edition", "firefox.exe"),
    },
    {
      kind: "firefox-dev",
      path: joinWin(programFilesX86, "Firefox Developer Edition", "firefox.exe"),
    },
  ];
  return findFirstExecutable(candidates);
}

/**
 * Resolve the Firefox executable for the given platform.
 * Returns null if no Firefox installation is found.
 */
export function resolveFirefoxExecutableForPlatform(
  platform: NodeJS.Platform,
): BrowserExecutable | null {
  if (platform === "darwin") {
    return findFirefoxExecutableMac();
  }
  if (platform === "linux") {
    return findFirefoxExecutableLinux();
  }
  if (platform === "win32") {
    return findFirefoxExecutableWindows();
  }
  return null;
}
