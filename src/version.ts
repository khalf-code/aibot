import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

declare const __OPENCLAW_VERSION__: string | undefined;

let cachedVersion: string | null = null;

function readVersionFromPackageJson(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Read version from package.json without using require cache.
 * This ensures we get the current version after git pull.
 */
function readVersionFromPackageJsonFresh(): string | null {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(currentDir, "../package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

function readVersionFromBuildInfo(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const candidates = ["../build-info.json", "./build-info.json"];
    for (const candidate of candidates) {
      try {
        const info = require(candidate) as { version?: string };
        if (info.version) {
          return info.version;
        }
      } catch {
        // ignore missing candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the cached version, forcing a fresh lookup on the next call.
 * Call this when the gateway restarts (e.g., after git pull + SIGUSR1).
 */
export function clearVersionCache(): void {
  cachedVersion = null;
}

/**
 * Resolve the current version, using cache for performance.
 * Use clearVersionCache() to force a fresh read after updates.
 */
export function resolveVersion(): string {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  const version =
    (typeof __OPENCLAW_VERSION__ === "string" && __OPENCLAW_VERSION__) ||
    process.env.OPENCLAW_BUNDLED_VERSION ||
    readVersionFromPackageJsonFresh() ||
    readVersionFromPackageJson() ||
    readVersionFromBuildInfo() ||
    "0.0.0";

  cachedVersion = version;
  return version;
}

// Single source of truth for the current OpenClaw version.
// - Embedded/bundled builds: injected define or env var.
// - Dev/npm builds: package.json.
// Note: This is computed once at module load. Use resolveVersion() for dynamic lookups.
export const VERSION =
  (typeof __OPENCLAW_VERSION__ === "string" && __OPENCLAW_VERSION__) ||
  process.env.OPENCLAW_BUNDLED_VERSION ||
  readVersionFromPackageJson() ||
  readVersionFromBuildInfo() ||
  "0.0.0";
