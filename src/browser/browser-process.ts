import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { BrowserExecutable } from "./chrome.executables.js";

/**
 * Shared type representing a running browser process (Chrome or Firefox).
 * For Chrome, `port` is the CDP debugging port.
 * For Firefox, `port` is the Playwright-managed Marionette port.
 */
export type RunningBrowser = {
  pid: number;
  exe: BrowserExecutable;
  userDataDir: string;
  cdpPort: number;
  startedAt: number;
  proc: ChildProcessWithoutNullStreams;
  engine: "chromium" | "firefox";
};
