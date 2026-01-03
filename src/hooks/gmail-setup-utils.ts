import fs from "node:fs";
import path from "node:path";

import { hasBinary } from "../agents/skills.js";
import { runCommandWithTimeout } from "../process/exec.js";
import { resolveUserPath } from "../utils.js";
import { normalizeServePath } from "./gmail.js";

function findExecutableOnPath(bin: string): string | undefined {
  const pathEnv = process.env.PATH ?? "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  for (const part of parts) {
    const candidate = path.join(part, bin);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep scanning
    }
  }
  return undefined;
}

function ensurePathIncludes(dirPath: string, position: "append" | "prepend") {
  const pathEnv = process.env.PATH ?? "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  if (parts.includes(dirPath)) return;
  const next =
    position === "prepend" ? [dirPath, ...parts] : [...parts, dirPath];
  process.env.PATH = next.join(path.delimiter);
}

function ensureGcloudOnPath(): boolean {
  if (hasBinary("gcloud")) return true;
  const candidates = [
    "/opt/homebrew/share/google-cloud-sdk/bin/gcloud",
    "/usr/local/share/google-cloud-sdk/bin/gcloud",
    "/opt/homebrew/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud",
    "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud",
  ];
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      ensurePathIncludes(path.dirname(candidate), "append");
      return true;
    } catch {
      // keep scanning
    }
  }
  return false;
}

function gcloudEnv(): NodeJS.ProcessEnv | undefined {
  if (process.env.CLOUDSDK_PYTHON) return undefined;
  const pythonPath =
    findExecutableOnPath("python3") ?? findExecutableOnPath("python");
  if (!pythonPath) return undefined;
  return { CLOUDSDK_PYTHON: pythonPath };
}

async function runGcloudCommand(
  args: string[],
  timeoutMs: number,
): Promise<Awaited<ReturnType<typeof runCommandWithTimeout>>> {
  return await runCommandWithTimeout(["gcloud", ...args], {
    timeoutMs,
    env: gcloudEnv(),
  });
}

export async function ensureDependency(bin: string, brewArgs: string[]) {
  if (bin === "gcloud" && ensureGcloudOnPath()) return;
  if (hasBinary(bin)) return;
  if (process.platform !== "darwin") {
    throw new Error(`${bin} not installed; install it and retry`);
  }
  if (!hasBinary("brew")) {
    throw new Error("Homebrew not installed (install brew and retry)");
  }
  const brewEnv = bin === "gcloud" ? gcloudEnv() : undefined;
  const result = await runCommandWithTimeout(["brew", "install", ...brewArgs], {
    timeoutMs: 600_000,
    env: brewEnv,
  });
  if (result.code !== 0) {
    throw new Error(
      `brew install failed for ${bin}: ${result.stderr || result.stdout}`,
    );
  }
  if (!hasBinary(bin)) {
    throw new Error(`${bin} still not available after brew install`);
  }
}

export async function ensureGcloudAuth() {
  const res = await runGcloudCommand(
    ["auth", "list", "--filter", "status:ACTIVE", "--format", "value(account)"],
    30_000,
  );
  if (res.code === 0 && res.stdout.trim()) return;
  const login = await runGcloudCommand(["auth", "login"], 600_000);
  if (login.code !== 0) {
    throw new Error(login.stderr || "gcloud auth login failed");
  }
}

export async function runGcloud(args: string[]) {
  const result = await runGcloudCommand(args, 120_000);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "gcloud command failed");
  }
  return result;
}

export async function ensureTopic(projectId: string, topicName: string) {
  const describe = await runGcloudCommand(
    ["pubsub", "topics", "describe", topicName, "--project", projectId],
    30_000,
  );
  if (describe.code === 0) return;
  await runGcloud([
    "pubsub",
    "topics",
    "create",
    topicName,
    "--project",
    projectId,
  ]);
}

export async function ensureSubscription(
  projectId: string,
  subscription: string,
  topicName: string,
  pushEndpoint: string,
) {
  const describe = await runGcloudCommand(
    ["pubsub", "subscriptions", "describe", subscription, "--project", projectId],
    30_000,
  );
  if (describe.code === 0) {
    await runGcloud([
      "pubsub",
      "subscriptions",
      "update",
      subscription,
      "--project",
      projectId,
      "--push-endpoint",
      pushEndpoint,
    ]);
    return;
  }
  await runGcloud([
    "pubsub",
    "subscriptions",
    "create",
    subscription,
    "--project",
    projectId,
    "--topic",
    topicName,
    "--push-endpoint",
    pushEndpoint,
  ]);
}

export async function ensureTailscaleEndpoint(params: {
  mode: "off" | "serve" | "funnel";
  path: string;
  port: number;
  token?: string;
}): Promise<string> {
  if (params.mode === "off") return "";

  const status = await runCommandWithTimeout(
    ["tailscale", "status", "--json"],
    {
      timeoutMs: 30_000,
    },
  );
  if (status.code !== 0) {
    throw new Error(status.stderr || "tailscale status failed");
  }
  const parsed = JSON.parse(status.stdout) as {
    Self?: { DNSName?: string };
  };
  const dnsName = parsed.Self?.DNSName?.replace(/\.$/, "");
  if (!dnsName) {
    throw new Error("tailscale DNS name missing; run tailscale up");
  }

  const target = String(params.port);
  const pathArg = normalizeServePath(params.path);
  const funnelArgs = [
    "tailscale",
    params.mode,
    "--bg",
    "--set-path",
    pathArg,
    "--yes",
    target,
  ];
  const funnelResult = await runCommandWithTimeout(funnelArgs, {
    timeoutMs: 30_000,
  });
  if (funnelResult.code !== 0) {
    throw new Error(funnelResult.stderr || "tailscale funnel failed");
  }

  const baseUrl = `https://${dnsName}${pathArg}`;
  // Funnel/serve strips pathArg before proxying; keep it only in the public URL.
  return params.token ? `${baseUrl}?token=${params.token}` : baseUrl;
}

export async function resolveProjectIdFromGogCredentials(): Promise<
  string | null
> {
  const candidates = gogCredentialsPaths();
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const raw = fs.readFileSync(candidate, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const clientId = extractGogClientId(parsed);
      const projectNumber = extractProjectNumber(clientId);
      if (!projectNumber) continue;
      const res = await runGcloudCommand(
        [
          "projects",
          "list",
          "--filter",
          `projectNumber=${projectNumber}`,
          "--format",
          "value(projectId)",
        ],
        30_000,
      );
      if (res.code !== 0) continue;
      const projectId = res.stdout.trim().split(/\s+/)[0];
      if (projectId) return projectId;
    } catch {
      // keep scanning
    }
  }
  return null;
}

function gogCredentialsPaths(): string[] {
  const paths: string[] = [];
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    paths.push(path.join(xdg, "gogcli", "credentials.json"));
  }
  paths.push(resolveUserPath("~/.config/gogcli/credentials.json"));
  if (process.platform === "darwin") {
    paths.push(
      resolveUserPath("~/Library/Application Support/gogcli/credentials.json"),
    );
  }
  return paths;
}

function extractGogClientId(parsed: Record<string, unknown>): string | null {
  const installed = parsed.installed as Record<string, unknown> | undefined;
  const web = parsed.web as Record<string, unknown> | undefined;
  const candidate =
    installed?.client_id || web?.client_id || parsed.client_id || "";
  return typeof candidate === "string" ? candidate : null;
}

function extractProjectNumber(clientId: string | null): string | null {
  if (!clientId) return null;
  const match = clientId.match(/^(\d+)-/);
  return match?.[1] ?? null;
}
