/**
 * OBS-001 (#85) -- Structured logging v1
 *
 * Provides a structured logging interface with contextual metadata,
 * log levels, and a pluggable logger implementation for the Clawdbot
 * agent runtime.
 */

// ---------------------------------------------------------------------------
// Log levels
// ---------------------------------------------------------------------------

/** Severity levels for log entries, ordered from least to most severe. */
export const enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
  Fatal = "fatal",
}

/** Numeric weight for each log level (used for filtering). */
const LOG_LEVEL_WEIGHT: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ---------------------------------------------------------------------------
// Log context
// ---------------------------------------------------------------------------

/**
 * Structured metadata attached to every log entry.
 * Callers can extend this with arbitrary key-value pairs.
 */
export type LogContext = {
  /** Unique identifier for the current run (correlates logs to runs). */
  runId?: string;
  /** Name of the skill being executed. */
  skillName?: string;
  /** Identifier for the step within a run. */
  stepId?: string;
  /** Trace/correlation ID for distributed tracing. */
  traceId?: string;
  /** Arbitrary additional fields. */
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Log entry
// ---------------------------------------------------------------------------

/** A single structured log record. */
export type LogEntry = {
  /** Log severity level. */
  level: LogLevel;
  /** Human-readable log message. */
  message: string;
  /** ISO-8601 timestamp of when the entry was created. */
  timestamp: string;
  /** Structured context/metadata for this entry. */
  context: LogContext;
  /** Error object, if this entry represents an error event. */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

// ---------------------------------------------------------------------------
// Logger interface
// ---------------------------------------------------------------------------

/** Contract for a structured logger implementation. */
export interface Logger {
  /** Log a debug-level message. */
  debug(message: string, context?: LogContext): void;

  /** Log an info-level message. */
  info(message: string, context?: LogContext): void;

  /** Log a warning-level message. */
  warn(message: string, context?: LogContext): void;

  /** Log an error-level message. */
  error(message: string, error?: Error, context?: LogContext): void;

  /** Log a fatal-level message (typically followed by process exit). */
  fatal(message: string, error?: Error, context?: LogContext): void;

  /**
   * Create a child logger with pre-bound context fields.
   * All entries from the child inherit the parent context.
   *
   * @param context - Fields to bind to every entry from the child logger.
   */
  child(context: LogContext): Logger;
}

// ---------------------------------------------------------------------------
// StructuredLogger implementation
// ---------------------------------------------------------------------------

/**
 * Default structured logger that formats entries as JSON and writes to
 * a configurable output sink.
 *
 * For production use, replace the `sink` with a transport that ships
 * entries to your log aggregation service (e.g. Datadog, Grafana Loki).
 */
export class StructuredLogger implements Logger {
  constructor(
    /** Minimum severity level to emit (entries below this are discarded). */
    private readonly minLevel: LogLevel = LogLevel.Info,
    /** Pre-bound context fields inherited by all entries. */
    private readonly baseContext: LogContext = {},
    /** Output sink -- defaults to `console.log`. */
    private readonly sink: (entry: LogEntry) => void = (entry) =>
      // biome-ignore lint/suspicious/noConsole: logger sink
      console.log(JSON.stringify(entry)),
  ) {}

  debug(message: string, context?: LogContext): void {
    this.emit(LogLevel.Debug, message, undefined, context);
  }

  info(message: string, context?: LogContext): void {
    this.emit(LogLevel.Info, message, undefined, context);
  }

  warn(message: string, context?: LogContext): void {
    this.emit(LogLevel.Warn, message, undefined, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.emit(LogLevel.Error, message, error, context);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.emit(LogLevel.Fatal, message, error, context);
  }

  child(context: LogContext): Logger {
    return new StructuredLogger(this.minLevel, { ...this.baseContext, ...context }, this.sink);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /** Build and emit a log entry if it meets the minimum severity threshold. */
  private emit(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
    if ((LOG_LEVEL_WEIGHT[level] ?? 0) < (LOG_LEVEL_WEIGHT[this.minLevel] ?? 0)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.baseContext, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.sink(entry);
  }
}
