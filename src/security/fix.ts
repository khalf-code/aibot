import fs from "node:fs/promises";
import path from "node:path";

import JSON5 from "json5";

import type { ClawdbotConfig } from "../config/config.js";
import { createConfigIO } from "../config/config.js";
import { resolveConfigPath, resolveOAuthDir, resolveStateDir } from "../config/paths.js";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import { INCLUDE_KEY, MAX_INCLUDE_DEPTH } from "../config/includes.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { readChannelAllowFromStore } from "../pairing/pairing-store.js";
import { runExec } from "../process/exec.js";
import { createIcaclsResetCommand, formatIcaclsResetCommand, type ExecFn } from "./windows-acl.js";
import { getDefaultRedactPatterns } from "../logging/redact.js";

export type SecurityFixChmodAction = {
  kind: "chmod";
  path: string;
  mode: number;
  ok: boolean;
  skipped?: string;
  error?: string;
};

export type SecurityFixIcaclsAction = {
  kind: "icacls";
  path: string;
  command: string;
  ok: boolean;
  skipped?: string;
  error?: string;
};

export type SecurityFixAction = SecurityFixChmodAction | SecurityFixIcaclsAction;

export type ExtractedSecret = {
  path: string[];
  value: string;
  envVar: string;
};

export type SecurityFixResult = {
  ok: boolean;
  stateDir: string;
  configPath: string;
  configWritten: boolean;
  changes: string[];
  actions: SecurityFixAction[];
  errors: string[];
  secretsExtracted?: ExtractedSecret[];
  envPath?: string;
};

async function safeChmod(params: {
  path: string;
  mode: number;
  require: "dir" | "file";
}): Promise<SecurityFixChmodAction> {
  try {
    const st = await fs.lstat(params.path);
    if (st.isSymbolicLink()) {
      return {
        kind: "chmod",
        path: params.path,
        mode: params.mode,
        ok: false,
        skipped: "symlink",
      };
    }
    if (params.require === "dir" && !st.isDirectory()) {
      return {
        kind: "chmod",
        path: params.path,
        mode: params.mode,
        ok: false,
        skipped: "not-a-directory",
      };
    }
    if (params.require === "file" && !st.isFile()) {
      return {
        kind: "chmod",
        path: params.path,
        mode: params.mode,
        ok: false,
        skipped: "not-a-file",
      };
    }
    const current = st.mode & 0o777;
    if (current === params.mode) {
      return {
        kind: "chmod",
        path: params.path,
        mode: params.mode,
        ok: false,
        skipped: "already",
      };
    }
    await fs.chmod(params.path, params.mode);
    return { kind: "chmod", path: params.path, mode: params.mode, ok: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return {
        kind: "chmod",
        path: params.path,
        mode: params.mode,
        ok: false,
        skipped: "missing",
      };
    }
    return {
      kind: "chmod",
      path: params.path,
      mode: params.mode,
      ok: false,
      error: String(err),
    };
  }
}

async function safeAclReset(params: {
  path: string;
  require: "dir" | "file";
  env: NodeJS.ProcessEnv;
  exec?: ExecFn;
}): Promise<SecurityFixIcaclsAction> {
  const display = formatIcaclsResetCommand(params.path, {
    isDir: params.require === "dir",
    env: params.env,
  });
  try {
    const st = await fs.lstat(params.path);
    if (st.isSymbolicLink()) {
      return {
        kind: "icacls",
        path: params.path,
        command: display,
        ok: false,
        skipped: "symlink",
      };
    }
    if (params.require === "dir" && !st.isDirectory()) {
      return {
        kind: "icacls",
        path: params.path,
        command: display,
        ok: false,
        skipped: "not-a-directory",
      };
    }
    if (params.require === "file" && !st.isFile()) {
      return {
        kind: "icacls",
        path: params.path,
        command: display,
        ok: false,
        skipped: "not-a-file",
      };
    }
    const cmd = createIcaclsResetCommand(params.path, {
      isDir: st.isDirectory(),
      env: params.env,
    });
    if (!cmd) {
      return {
        kind: "icacls",
        path: params.path,
        command: display,
        ok: false,
        skipped: "missing-user",
      };
    }
    const exec = params.exec ?? runExec;
    await exec(cmd.command, cmd.args);
    return { kind: "icacls", path: params.path, command: cmd.display, ok: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return {
        kind: "icacls",
        path: params.path,
        command: display,
        ok: false,
        skipped: "missing",
      };
    }
    return {
      kind: "icacls",
      path: params.path,
      command: display,
      ok: false,
      error: String(err),
    };
  }
}

function setGroupPolicyAllowlist(params: {
  cfg: ClawdbotConfig;
  channel: string;
  changes: string[];
  policyFlips: Set<string>;
}): void {
  if (!params.cfg.channels) return;
  const section = params.cfg.channels[params.channel as keyof ClawdbotConfig["channels"]] as
    | Record<string, unknown>
    | undefined;
  if (!section || typeof section !== "object") return;

  const topPolicy = section.groupPolicy;
  if (topPolicy === "open") {
    section.groupPolicy = "allowlist";
    params.changes.push(`channels.${params.channel}.groupPolicy=open -> allowlist`);
    params.policyFlips.add(`channels.${params.channel}.`);
  }

  const accounts = section.accounts;
  if (!accounts || typeof accounts !== "object") return;
  for (const [accountId, accountValue] of Object.entries(accounts)) {
    if (!accountId) continue;
    if (!accountValue || typeof accountValue !== "object") continue;
    const account = accountValue as Record<string, unknown>;
    if (account.groupPolicy === "open") {
      account.groupPolicy = "allowlist";
      params.changes.push(
        `channels.${params.channel}.accounts.${accountId}.groupPolicy=open -> allowlist`,
      );
      params.policyFlips.add(`channels.${params.channel}.accounts.${accountId}.`);
    }
  }
}

function setWhatsAppGroupAllowFromFromStore(params: {
  cfg: ClawdbotConfig;
  storeAllowFrom: string[];
  changes: string[];
  policyFlips: Set<string>;
}): void {
  const section = params.cfg.channels?.whatsapp as Record<string, unknown> | undefined;
  if (!section || typeof section !== "object") return;
  if (params.storeAllowFrom.length === 0) return;

  const maybeApply = (prefix: string, obj: Record<string, unknown>) => {
    if (!params.policyFlips.has(prefix)) return;
    const allowFrom = Array.isArray(obj.allowFrom) ? obj.allowFrom : [];
    const groupAllowFrom = Array.isArray(obj.groupAllowFrom) ? obj.groupAllowFrom : [];
    if (allowFrom.length > 0) return;
    if (groupAllowFrom.length > 0) return;
    obj.groupAllowFrom = params.storeAllowFrom;
    params.changes.push(`${prefix}groupAllowFrom=pairing-store`);
  };

  maybeApply("channels.whatsapp.", section);

  const accounts = section.accounts;
  if (!accounts || typeof accounts !== "object") return;
  for (const [accountId, accountValue] of Object.entries(accounts)) {
    if (!accountValue || typeof accountValue !== "object") continue;
    const account = accountValue as Record<string, unknown>;
    maybeApply(`channels.whatsapp.accounts.${accountId}.`, account);
  }
}

function applyConfigFixes(params: { cfg: ClawdbotConfig; env: NodeJS.ProcessEnv }): {
  cfg: ClawdbotConfig;
  changes: string[];
  policyFlips: Set<string>;
} {
  const next = structuredClone(params.cfg ?? {});
  const changes: string[] = [];
  const policyFlips = new Set<string>();

  if (next.logging?.redactSensitive === "off") {
    next.logging = { ...next.logging, redactSensitive: "tools" };
    changes.push('logging.redactSensitive=off -> "tools"');
  }

  for (const channel of [
    "telegram",
    "whatsapp",
    "discord",
    "signal",
    "imessage",
    "slack",
    "msteams",
  ]) {
    setGroupPolicyAllowlist({ cfg: next, channel, changes, policyFlips });
  }

  return { cfg: next, changes, policyFlips };
}

// Secret extraction helpers
function looksLikeEnvRef(value: string): boolean {
  const v = value.trim();
  return v.startsWith("${") && v.endsWith("}");
}

function looksLikeSecret(value: string): boolean {
  if (typeof value !== "string" || value.length < 16) return false;
  if (looksLikeEnvRef(value)) return false;

  // Compile redact patterns and test against value
  const patterns = getDefaultRedactPatterns();
  for (const p of patterns) {
    try {
      const re = new RegExp(p, "i");
      if (re.test(value)) return true;
    } catch {
      continue;
    }
  }

  // High-entropy fallback for unknown formats
  if (value.length >= 32 && /^[A-Za-z0-9_-]+$/.test(value)) {
    const entropy = new Set(value).size / value.length;
    if (entropy > 0.4) return true;
  }

  return false;
}

function pathToEnvVarName(configPath: string[]): string {
  const parts: string[] = [];

  for (const segment of configPath) {
    // Skip generic container names
    if (
      ["channels", "accounts", "providers", "entries", "list", "env", "docker", "sandbox"].includes(
        segment,
      )
    ) {
      continue;
    }
    // Normalize known field names
    if (segment === "token") parts.push("TOKEN");
    else if (segment === "botToken") parts.push("BOT_TOKEN");
    else if (segment === "apiKey") parts.push("API_KEY");
    else if (segment === "password") parts.push("PASSWORD");
    else if (segment === "controlToken") parts.push("CONTROL_TOKEN");
    else parts.push(segment.toUpperCase().replace(/-/g, "_"));
  }

  const name = parts.join("_");
  return name.startsWith("CLAWDBOT_") ? name : `CLAWDBOT_${name}`;
}

function findSecrets(obj: unknown, currentPath: string[] = []): ExtractedSecret[] {
  const secrets: ExtractedSecret[] = [];

  if (typeof obj === "string") {
    if (looksLikeSecret(obj)) {
      secrets.push({
        path: currentPath,
        value: obj,
        envVar: pathToEnvVarName(currentPath),
      });
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      secrets.push(...findSecrets(obj[i], [...currentPath, String(i)]));
    }
  } else if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      secrets.push(...findSecrets(value, [...currentPath, key]));
    }
  }

  return secrets;
}

function setValueAtPath(
  obj: Record<string, unknown>,
  configPath: string[],
  newValue: string,
): void {
  let current: unknown = obj;
  for (let i = 0; i < configPath.length - 1; i++) {
    const key = configPath[i];
    if (Array.isArray(current)) {
      current = current[Number(key)];
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return;
    }
  }

  const finalKey = configPath[configPath.length - 1];
  if (Array.isArray(current)) {
    current[Number(finalKey)] = newValue;
  } else if (current && typeof current === "object") {
    (current as Record<string, unknown>)[finalKey] = newValue;
  }
}

export function extractSecretsFromConfig(cfg: ClawdbotConfig): {
  updatedConfig: ClawdbotConfig;
  secrets: ExtractedSecret[];
} {
  const secrets = findSecrets(cfg);

  // Deduplicate env var names (add suffix if needed)
  const usedNames = new Set<string>();
  for (const secret of secrets) {
    let name = secret.envVar;
    let counter = 1;
    while (usedNames.has(name)) {
      name = `${secret.envVar}_${counter}`;
      counter++;
    }
    secret.envVar = name;
    usedNames.add(name);
  }

  // Clone config and replace values with env var references
  const updatedConfig = structuredClone(cfg);
  for (const secret of secrets) {
    setValueAtPath(updatedConfig as Record<string, unknown>, secret.path, `\${${secret.envVar}}`);
  }

  return { updatedConfig, secrets };
}

export async function writeEnvFile(params: {
  envPath: string;
  secrets: ExtractedSecret[];
  append?: boolean;
}): Promise<void> {
  const lines = [
    "# Clawdbot Secrets - DO NOT COMMIT",
    `# Generated by clawdbot security audit --fix`,
    "",
  ];

  for (const secret of params.secrets) {
    lines.push(`${secret.envVar}=${secret.value}`);
  }

  const content = lines.join("\n") + "\n";

  if (params.append) {
    await fs.appendFile(params.envPath, "\n" + content);
  } else {
    await fs.writeFile(params.envPath, content);
  }

  // Secure permissions
  await fs.chmod(params.envPath, 0o600);
}

function listDirectIncludes(parsed: unknown): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object") return;
    const rec = value as Record<string, unknown>;
    const includeVal = rec[INCLUDE_KEY];
    if (typeof includeVal === "string") out.push(includeVal);
    else if (Array.isArray(includeVal)) {
      for (const item of includeVal) {
        if (typeof item === "string") out.push(item);
      }
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(parsed);
  return out;
}

function resolveIncludePath(baseConfigPath: string, includePath: string): string {
  return path.normalize(
    path.isAbsolute(includePath)
      ? includePath
      : path.resolve(path.dirname(baseConfigPath), includePath),
  );
}

async function collectIncludePathsRecursive(params: {
  configPath: string;
  parsed: unknown;
}): Promise<string[]> {
  const visited = new Set<string>();
  const result: string[] = [];

  const walk = async (basePath: string, parsed: unknown, depth: number): Promise<void> => {
    if (depth > MAX_INCLUDE_DEPTH) return;
    for (const raw of listDirectIncludes(parsed)) {
      const resolved = resolveIncludePath(basePath, raw);
      if (visited.has(resolved)) continue;
      visited.add(resolved);
      result.push(resolved);
      const rawText = await fs.readFile(resolved, "utf-8").catch(() => null);
      if (!rawText) continue;
      const nestedParsed = (() => {
        try {
          return JSON5.parse(rawText) as unknown;
        } catch {
          return null;
        }
      })();
      if (nestedParsed) {
        // eslint-disable-next-line no-await-in-loop
        await walk(resolved, nestedParsed, depth + 1);
      }
    }
  };

  await walk(params.configPath, params.parsed, 0);
  return result;
}

async function chmodCredentialsAndAgentState(params: {
  env: NodeJS.ProcessEnv;
  stateDir: string;
  cfg: ClawdbotConfig;
  actions: SecurityFixAction[];
  applyPerms: (params: {
    path: string;
    mode: number;
    require: "dir" | "file";
  }) => Promise<SecurityFixAction>;
}): Promise<void> {
  const credsDir = resolveOAuthDir(params.env, params.stateDir);
  params.actions.push(await safeChmod({ path: credsDir, mode: 0o700, require: "dir" }));

  const credsEntries = await fs.readdir(credsDir, { withFileTypes: true }).catch(() => []);
  for (const entry of credsEntries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".json")) continue;
    const p = path.join(credsDir, entry.name);
    // eslint-disable-next-line no-await-in-loop
    params.actions.push(await safeChmod({ path: p, mode: 0o600, require: "file" }));
  }

  const ids = new Set<string>();
  ids.add(resolveDefaultAgentId(params.cfg));
  const list = Array.isArray(params.cfg.agents?.list) ? params.cfg.agents?.list : [];
  for (const agent of list ?? []) {
    if (!agent || typeof agent !== "object") continue;
    const id =
      typeof (agent as { id?: unknown }).id === "string" ? (agent as { id: string }).id.trim() : "";
    if (id) ids.add(id);
  }

  for (const agentId of ids) {
    const normalizedAgentId = normalizeAgentId(agentId);
    const agentRoot = path.join(params.stateDir, "agents", normalizedAgentId);
    const agentDir = path.join(agentRoot, "agent");
    const sessionsDir = path.join(agentRoot, "sessions");

    // eslint-disable-next-line no-await-in-loop
    params.actions.push(await safeChmod({ path: agentRoot, mode: 0o700, require: "dir" }));
    // eslint-disable-next-line no-await-in-loop
    params.actions.push(await params.applyPerms({ path: agentDir, mode: 0o700, require: "dir" }));

    const authPath = path.join(agentDir, "auth-profiles.json");
    // eslint-disable-next-line no-await-in-loop
    params.actions.push(await params.applyPerms({ path: authPath, mode: 0o600, require: "file" }));

    // eslint-disable-next-line no-await-in-loop
    params.actions.push(
      await params.applyPerms({ path: sessionsDir, mode: 0o700, require: "dir" }),
    );

    const storePath = path.join(sessionsDir, "sessions.json");
    // eslint-disable-next-line no-await-in-loop
    params.actions.push(await params.applyPerms({ path: storePath, mode: 0o600, require: "file" }));
  }
}

export async function fixSecurityFootguns(opts?: {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  configPath?: string;
  platform?: NodeJS.Platform;
  exec?: ExecFn;
}): Promise<SecurityFixResult> {
  const env = opts?.env ?? process.env;
  const platform = opts?.platform ?? process.platform;
  const exec = opts?.exec ?? runExec;
  const isWindows = platform === "win32";
  const stateDir = opts?.stateDir ?? resolveStateDir(env);
  const configPath = opts?.configPath ?? resolveConfigPath(env, stateDir);
  const actions: SecurityFixAction[] = [];
  const errors: string[] = [];

  const io = createConfigIO({ env, configPath });
  const snap = await io.readConfigFileSnapshot();
  if (!snap.valid) {
    errors.push(...snap.issues.map((i) => `${i.path}: ${i.message}`));
  }

  let configWritten = false;
  let changes: string[] = [];
  let secretsExtracted: ExtractedSecret[] | undefined;
  let envPath: string | undefined;

  if (snap.valid) {
    const fixed = applyConfigFixes({ cfg: snap.config, env });
    changes = fixed.changes;

    const whatsappStoreAllowFrom = await readChannelAllowFromStore("whatsapp", env).catch(() => []);
    if (whatsappStoreAllowFrom.length > 0) {
      setWhatsAppGroupAllowFromFromStore({
        cfg: fixed.cfg,
        storeAllowFrom: whatsappStoreAllowFrom,
        changes,
        policyFlips: fixed.policyFlips,
      });
    }

    // Extract secrets to .env
    const extraction = extractSecretsFromConfig(fixed.cfg);
    if (extraction.secrets.length > 0) {
      secretsExtracted = extraction.secrets;
      envPath = path.join(stateDir, ".env");

      try {
        await writeEnvFile({ envPath, secrets: extraction.secrets });
        changes.push(`extracted ${extraction.secrets.length} secret(s) to ${envPath}`);

        // Use the updated config with env var references
        Object.assign(fixed.cfg, extraction.updatedConfig);
      } catch (err) {
        errors.push(`writeEnvFile failed: ${String(err)}`);
      }
    }

    if (changes.length > 0) {
      try {
        await io.writeConfigFile(fixed.cfg);
        configWritten = true;
      } catch (err) {
        errors.push(`writeConfigFile failed: ${String(err)}`);
      }
    }
  }

  const applyPerms = (params: { path: string; mode: number; require: "dir" | "file" }) =>
    isWindows
      ? safeAclReset({ path: params.path, require: params.require, env, exec })
      : safeChmod({ path: params.path, mode: params.mode, require: params.require });

  actions.push(await applyPerms({ path: stateDir, mode: 0o700, require: "dir" }));
  actions.push(await applyPerms({ path: configPath, mode: 0o600, require: "file" }));

  if (snap.exists) {
    const includePaths = await collectIncludePathsRecursive({
      configPath: snap.path,
      parsed: snap.parsed,
    }).catch(() => []);
    for (const p of includePaths) {
      // eslint-disable-next-line no-await-in-loop
      actions.push(await applyPerms({ path: p, mode: 0o600, require: "file" }));
    }
  }

  await chmodCredentialsAndAgentState({
    env,
    stateDir,
    cfg: snap.config ?? {},
    actions,
    applyPerms,
  }).catch((err) => {
    errors.push(`chmodCredentialsAndAgentState failed: ${String(err)}`);
  });

  return {
    ok: errors.length === 0,
    stateDir,
    configPath,
    configWritten,
    changes,
    actions,
    errors,
    secretsExtracted,
    envPath,
  };
}
