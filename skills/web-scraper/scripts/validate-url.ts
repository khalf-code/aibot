#!/usr/bin/env bun
import { lookup } from "dns/promises";
import { isIP } from "net";

type ValidationResult = { valid: boolean; error?: string };

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const BLOCKED_SCHEMES = new Set(["file:", "ftp:", "gopher:"]);

const isBlockedIpv4 = (ip: string): boolean => {
  if (ip === "0.0.0.0") return true;
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const isBlockedIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized === "0:0:0:0:0:0:0:1";
};

const isBlockedIp = (ip: string): boolean => {
  const ipVersion = isIP(ip);
  if (ipVersion === 4) return isBlockedIpv4(ip);
  if (ipVersion === 6) return isBlockedIpv6(ip);
  return false;
};

export const validateUrl = async (url: string): Promise<ValidationResult> => {
  if (!url) {
    return { valid: false, error: "URL is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (BLOCKED_SCHEMES.has(parsed.protocol)) {
    return { valid: false, error: `Scheme ${parsed.protocol} is not allowed` };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { valid: false, error: "Only http and https URLs are allowed" };
  }

  const hostname = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (!hostname) {
    return { valid: false, error: "URL must include a hostname" };
  }

  if (hostname === "localhost") {
    return { valid: false, error: "localhost is not allowed" };
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { valid: false, error: "IP address is not allowed" };
    }
    return { valid: true };
  }

  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (resolved.length === 0) {
      return { valid: false, error: "Hostname did not resolve" };
    }

    for (const record of resolved) {
      if (isBlockedIp(record.address)) {
        return { valid: false, error: "Resolved IP address is not allowed" };
      }
    }
  } catch {
    return { valid: false, error: "Failed to resolve hostname" };
  }

  return { valid: true };
};

const runCli = async () => {
  const [url] = process.argv.slice(2);
  if (!url) {
    console.error("Usage: bun run validate-url.ts <url>");
    process.exit(1);
  }

  const result = await validateUrl(url);
  if (!result.valid) {
    console.error(result.error ?? "URL validation failed");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ valid: true }) + "\n");
};

if (import.meta.main) {
  runCli();
}
