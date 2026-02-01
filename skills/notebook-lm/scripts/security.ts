#!/usr/bin/env bun

import { statSync, chmodSync, appendFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { homedir } from "os";

const REQUIRED_MODE = 0o700;
const LOG_FILE = resolve(homedir(), ".config/moltbot/notebook-lm-access.log");

export type AccessEvent = {
  timestamp: string;
  action: "auth" | "upload" | "validate";
  profilePath: string;
  success: boolean;
  error?: string;
  pid: number;
  user: string;
};

export function expandHome(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return resolve(homedir(), inputPath.slice(2));
  }
  return inputPath;
}

export function getPermissions(path: string): number {
  try {
    const stats = statSync(path);
    return stats.mode & 0o777;
  } catch {
    return -1;
  }
}

export function isSecurePermissions(path: string): boolean {
  const mode = getPermissions(path);
  if (mode === -1) return false;
  const groupOther = mode & 0o077;
  return groupOther === 0;
}

export function validateProfilePermissions(profilePath: string): { valid: boolean; error?: string } {
  const expandedPath = expandHome(profilePath);
  
  if (!statSync(expandedPath, { throwIfNoEntry: false })) {
    return { valid: true };
  }

  const configDir = dirname(expandedPath);
  
  if (!isSecurePermissions(configDir)) {
    const mode = getPermissions(configDir).toString(8);
    return {
      valid: false,
      error: `SECURITY ERROR: Parent directory ${configDir} has insecure permissions (${mode}). Expected 700 or stricter.`,
    };
  }

  if (!isSecurePermissions(expandedPath)) {
    const mode = getPermissions(expandedPath).toString(8);
    return {
      valid: false,
      error: `SECURITY ERROR: Profile directory ${expandedPath} has insecure permissions (${mode}). Expected 700 or stricter.`,
    };
  }

  return { valid: true };
}

export function setSecurePermissions(profilePath: string): { success: boolean; error?: string } {
  const expandedPath = expandHome(profilePath);
  const configDir = dirname(expandedPath);

  try {
    mkdirSync(configDir, { recursive: true, mode: REQUIRED_MODE });
    
    if (statSync(expandedPath, { throwIfNoEntry: false })) {
      chmodSync(expandedPath, REQUIRED_MODE);
    }

    chmodSync(configDir, REQUIRED_MODE);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Failed to set permissions: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function logAccess(event: Omit<AccessEvent, "timestamp" | "pid" | "user">): void {
  const fullEvent: AccessEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    user: process.env.USER || "unknown",
  };

  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true, mode: REQUIRED_MODE });
    appendFileSync(LOG_FILE, JSON.stringify(fullEvent) + "\n", { mode: 0o600 });
  } catch {
    console.error("[security] Failed to write access log");
  }
}

export function requireSecureProfile(profilePath: string, action: AccessEvent["action"]): void {
  const validation = validateProfilePermissions(profilePath);
  
  if (!validation.valid) {
    logAccess({
      action,
      profilePath,
      success: false,
      error: validation.error,
    });

    console.error("\n" + "=".repeat(60));
    console.error("SECURITY ERROR - ABORTING");
    console.error("=".repeat(60));
    console.error(validation.error);
    console.error("\nTo fix, run:");
    console.error(`  chmod 700 "${dirname(expandHome(profilePath))}"`);
    console.error(`  chmod 700 "${expandHome(profilePath)}"`);
    console.error("=".repeat(60) + "\n");
    
    process.exit(1);
  }

  logAccess({
    action,
    profilePath,
    success: true,
  });
}
