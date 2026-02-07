import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function resolveNpmCliJs() {
  const fromEnv = process.env.npm_execpath;
  if (fromEnv?.includes(`${path.sep}npm${path.sep}`) && fromEnv.endsWith("npm-cli.js")) {
    return fromEnv;
  }

  const fromNodeDir = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (fs.existsSync(fromNodeDir)) {
    return fromNodeDir;
  }

  const fromLibNodeModules = path.resolve(
    path.dirname(process.execPath),
    "..",
    "lib",
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (fs.existsSync(fromLibNodeModules)) {
    return fromLibNodeModules;
  }

  return null;
}

function runCommand(cmd: string, args: string[], cwd: string) {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf-8" });
  expect(res.status).toBe(0);
  if (res.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed: ${res.stderr || res.stdout || "<no output>"}`,
    );
  }
  return res.stdout || "";
}

describe("sig packaging", () => {
  it("includes sig config and signatures in npm pack tarball", () => {
    const cwd = process.cwd();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-pack-"));

    try {
      const npmCli = resolveNpmCliJs();
      const packCmd = npmCli ? process.execPath : "npm";
      const packArgs = npmCli
        ? [npmCli, "pack", "--ignore-scripts", "--silent", "--pack-destination", outDir, cwd]
        : ["pack", "--ignore-scripts", "--silent", "--pack-destination", outDir, cwd];
      const stdout = runCommand(packCmd, packArgs, cwd);
      const archiveName = stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);
      if (!archiveName) {
        throw new Error(`npm pack did not return an archive name: ${stdout}`);
      }

      const archivePath = path.join(outDir, archiveName);
      const tarList = runCommand("tar", ["tf", archivePath], cwd)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      expect(tarList).toContain("package/.sig/config.json");
      expect(
        tarList.some(
          (entry) => entry.startsWith("package/.sig/sigs/") && entry.endsWith(".sig.json"),
        ),
      ).toBe(true);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
