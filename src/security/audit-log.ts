/**
 * Audit Logging System
 * 
 * Records security-sensitive operations for compliance, debugging, and forensics.
 * 
 * Features:
 * - Structured JSON log format
 * - Configurable log levels and categories
 * - File rotation support
 * - Tamper-evident checksums (optional)
 * - PII redaction support
 * 
 * @module security/audit-log
 */

import { createWriteStream, existsSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { WriteStream } from "node:fs";

// ============================================================================
// Types
// ============================================================================

export type AuditCategory =
  | "auth"           // Authentication events (login, logout, token refresh)
  | "config"         // Configuration changes
  | "exec"           // Command execution (shell, elevated)
  | "tool"           // Tool invocations
  | "message"        // Message handling (send, receive)
  | "file"           // File operations (read, write, delete)
  | "session"        // Session events (create, destroy, switch)
  | "channel"        // Channel events (connect, disconnect)
  | "cron"           // Cron job events
  | "pairing"        // Device pairing events
  | "admin";         // Administrative actions

export type AuditSeverity = "info" | "warn" | "critical";

export type AuditAction =
  // Auth actions
  | "auth.login"
  | "auth.logout"
  | "auth.token_refresh"
  | "auth.token_expired"
  | "auth.failed"
  // Config actions
  | "config.read"
  | "config.write"
  | "config.apply"
  | "config.reset"
  // Exec actions
  | "exec.run"
  | "exec.elevated"
  | "exec.blocked"
  | "exec.timeout"
  // Tool actions
  | "tool.invoke"
  | "tool.denied"
  | "tool.error"
  // Message actions
  | "message.receive"
  | "message.send"
  | "message.blocked"
  // File actions
  | "file.read"
  | "file.write"
  | "file.delete"
  | "file.denied"
  // Session actions
  | "session.create"
  | "session.destroy"
  | "session.switch"
  | "session.timeout"
  // Channel actions
  | "channel.connect"
  | "channel.disconnect"
  | "channel.error"
  // Cron actions
  | "cron.run"
  | "cron.add"
  | "cron.remove"
  | "cron.error"
  // Pairing actions
  | "pairing.request"
  | "pairing.approve"
  | "pairing.reject"
  | "pairing.revoke"
  // Admin actions
  | "admin.restart"
  | "admin.update"
  | "admin.shutdown";

export interface AuditLogEntry {
  /** ISO 8601 timestamp */
  ts: string;
  /** Monotonic sequence number for ordering */
  seq: number;
  /** Event category */
  category: AuditCategory;
  /** Specific action */
  action: AuditAction;
  /** Severity level */
  severity: AuditSeverity;
  /** Human-readable description */
  message: string;
  /** Actor who triggered the event */
  actor?: {
    type: "user" | "system" | "cron" | "agent";
    id?: string;
    channel?: string;
    ip?: string;
  };
  /** Target of the action */
  target?: {
    type: string;
    id?: string;
    path?: string;
  };
  /** Action result */
  result?: {
    success: boolean;
    error?: string;
    duration_ms?: number;
  };
  /** Additional context (redacted if needed) */
  context?: Record<string, unknown>;
  /** SHA-256 of previous entry for tamper detection */
  prev_hash?: string;
}

export interface AuditLogConfig {
  /** Enable audit logging */
  enabled: boolean;
  /** Log file path */
  path: string;
  /** Categories to log (empty = all) */
  categories?: AuditCategory[];
  /** Minimum severity to log */
  minSeverity?: AuditSeverity;
  /** Enable tamper-evident chain */
  enableChain?: boolean;
  /** Max file size before rotation (bytes) */
  maxFileSize?: number;
  /** Max rotated files to keep */
  maxFiles?: number;
  /** Redact PII from logs */
  redactPii?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: AuditLogConfig = {
  enabled: true,
  path: "audit.log",
  minSeverity: "info",
  enableChain: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  redactPii: true,
};

const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  info: 0,
  warn: 1,
  critical: 2,
};

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\+?[1-9]\d{1,14}\b/g, // Phone numbers
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b(?:sk-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]+\b/g, // API keys
];

// ============================================================================
// Audit Logger Class
// ============================================================================

export class AuditLogger {
  private config: AuditLogConfig;
  private stream: WriteStream | null = null;
  private seq = 0;
  private lastHash: string | null = null;
  private closed = false;

  constructor(config: Partial<AuditLogConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.enabled) {
      this.initStream();
    }
  }

  private initStream(): void {
    const dir = dirname(this.config.path);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.maybeRotate();
    this.stream = createWriteStream(this.config.path, { flags: "a" });
  }

  private maybeRotate(): void {
    if (!existsSync(this.config.path)) return;
    
    const stats = statSync(this.config.path);
    if (stats.size < (this.config.maxFileSize ?? DEFAULT_CONFIG.maxFileSize!)) {
      return;
    }

    // Rotate files
    const maxFiles = this.config.maxFiles ?? DEFAULT_CONFIG.maxFiles!;
    for (let i = maxFiles - 1; i >= 1; i--) {
      const oldPath = `${this.config.path}.${i}`;
      const newPath = `${this.config.path}.${i + 1}`;
      if (existsSync(oldPath)) {
        if (i === maxFiles - 1) {
          // Delete oldest
          require("node:fs").unlinkSync(oldPath);
        } else {
          renameSync(oldPath, newPath);
        }
      }
    }
    renameSync(this.config.path, `${this.config.path}.1`);
  }

  private shouldLog(category: AuditCategory, severity: AuditSeverity): boolean {
    if (!this.config.enabled || this.closed) return false;

    // Check category filter
    if (this.config.categories && this.config.categories.length > 0) {
      if (!this.config.categories.includes(category)) return false;
    }

    // Check severity filter
    const minSeverity = this.config.minSeverity ?? "info";
    if (SEVERITY_ORDER[severity] < SEVERITY_ORDER[minSeverity]) return false;

    return true;
  }

  private redactPii(text: string): string {
    if (!this.config.redactPii) return text;
    let result = text;
    for (const pattern of PII_PATTERNS) {
      result = result.replace(pattern, "[REDACTED]");
    }
    return result;
  }

  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    if (!this.config.redactPii) return obj;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.redactPii(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.redactObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private computeHash(entry: AuditLogEntry): string {
    const content = JSON.stringify(entry);
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  /**
   * Log an audit event
   */
  log(params: {
    category: AuditCategory;
    action: AuditAction;
    severity?: AuditSeverity;
    message: string;
    actor?: AuditLogEntry["actor"];
    target?: AuditLogEntry["target"];
    result?: AuditLogEntry["result"];
    context?: Record<string, unknown>;
  }): void {
    const severity = params.severity ?? "info";
    if (!this.shouldLog(params.category, severity)) return;

    this.seq += 1;

    const entry: AuditLogEntry = {
      ts: new Date().toISOString(),
      seq: this.seq,
      category: params.category,
      action: params.action,
      severity,
      message: this.redactPii(params.message),
      actor: params.actor,
      target: params.target,
      result: params.result,
      context: params.context ? this.redactObject(params.context) : undefined,
    };

    // Add chain hash if enabled
    if (this.config.enableChain && this.lastHash) {
      entry.prev_hash = this.lastHash;
    }

    // Compute hash for next entry
    if (this.config.enableChain) {
      this.lastHash = this.computeHash(entry);
    }

    // Write to file
    if (this.stream) {
      this.stream.write(JSON.stringify(entry) + "\n");
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /** Log authentication event */
  auth(action: "auth.login" | "auth.logout" | "auth.token_refresh" | "auth.token_expired" | "auth.failed", params: {
    message: string;
    actor?: AuditLogEntry["actor"];
    result?: AuditLogEntry["result"];
    context?: Record<string, unknown>;
  }): void {
    this.log({
      category: "auth",
      action,
      severity: action === "auth.failed" ? "warn" : "info",
      ...params,
    });
  }

  /** Log exec event */
  exec(action: "exec.run" | "exec.elevated" | "exec.blocked" | "exec.timeout", params: {
    message: string;
    command?: string;
    actor?: AuditLogEntry["actor"];
    result?: AuditLogEntry["result"];
    context?: Record<string, unknown>;
  }): void {
    const severity: AuditSeverity = 
      action === "exec.elevated" ? "warn" :
      action === "exec.blocked" ? "warn" :
      "info";
    
    this.log({
      category: "exec",
      action,
      severity,
      message: params.message,
      actor: params.actor,
      target: params.command ? { type: "command", id: params.command } : undefined,
      result: params.result,
      context: params.context,
    });
  }

  /** Log tool invocation */
  tool(action: "tool.invoke" | "tool.denied" | "tool.error", params: {
    toolName: string;
    message: string;
    actor?: AuditLogEntry["actor"];
    result?: AuditLogEntry["result"];
    context?: Record<string, unknown>;
  }): void {
    const severity: AuditSeverity = 
      action === "tool.denied" ? "warn" :
      action === "tool.error" ? "warn" :
      "info";
    
    this.log({
      category: "tool",
      action,
      severity,
      message: params.message,
      actor: params.actor,
      target: { type: "tool", id: params.toolName },
      result: params.result,
      context: params.context,
    });
  }

  /** Log config change */
  config(action: "config.read" | "config.write" | "config.apply" | "config.reset", params: {
    message: string;
    actor?: AuditLogEntry["actor"];
    result?: AuditLogEntry["result"];
    context?: Record<string, unknown>;
  }): void {
    const severity: AuditSeverity = 
      action === "config.write" || action === "config.apply" ? "warn" :
      "info";
    
    this.log({
      category: "config",
      action,
      severity,
      ...params,
    });
  }

  /** Log file operation */
  file(action: "file.read" | "file.write" | "file.delete" | "file.denied", params: {
    path: string;
    message: string;
    actor?: AuditLogEntry["actor"];
    result?: AuditLogEntry["result"];
    context?: Record<string, unknown>;
  }): void {
    const severity: AuditSeverity = 
      action === "file.delete" ? "warn" :
      action === "file.denied" ? "warn" :
      "info";
    
    this.log({
      category: "file",
      action,
      severity,
      message: params.message,
      actor: params.actor,
      target: { type: "file", path: params.path },
      result: params.result,
      context: params.context,
    });
  }

  /** Log critical security event */
  critical(params: {
    category: AuditCategory;
    action: AuditAction;
    message: string;
    actor?: AuditLogEntry["actor"];
    target?: AuditLogEntry["target"];
    result?: AuditLogEntry["result"];
    context?: Record<string, unknown>;
  }): void {
    this.log({ ...params, severity: "critical" });
  }

  /**
   * Close the audit logger
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.closed = true;
      if (this.stream) {
        this.stream.end(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalAuditLogger: AuditLogger | null = null;

/**
 * Initialize the global audit logger
 */
export function initAuditLogger(config: Partial<AuditLogConfig> = {}): AuditLogger {
  if (globalAuditLogger) {
    globalAuditLogger.close();
  }
  globalAuditLogger = new AuditLogger(config);
  return globalAuditLogger;
}

/**
 * Get the global audit logger instance
 */
export function getAuditLogger(): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger();
  }
  return globalAuditLogger;
}

/**
 * Shorthand for logging audit events
 */
export const audit = {
  auth: (action: Parameters<AuditLogger["auth"]>[0], params: Parameters<AuditLogger["auth"]>[1]) =>
    getAuditLogger().auth(action, params),
  exec: (action: Parameters<AuditLogger["exec"]>[0], params: Parameters<AuditLogger["exec"]>[1]) =>
    getAuditLogger().exec(action, params),
  tool: (action: Parameters<AuditLogger["tool"]>[0], params: Parameters<AuditLogger["tool"]>[1]) =>
    getAuditLogger().tool(action, params),
  config: (action: Parameters<AuditLogger["config"]>[0], params: Parameters<AuditLogger["config"]>[1]) =>
    getAuditLogger().config(action, params),
  file: (action: Parameters<AuditLogger["file"]>[0], params: Parameters<AuditLogger["file"]>[1]) =>
    getAuditLogger().file(action, params),
  critical: (params: Parameters<AuditLogger["critical"]>[0]) =>
    getAuditLogger().critical(params),
  log: (params: Parameters<AuditLogger["log"]>[0]) =>
    getAuditLogger().log(params),
};
