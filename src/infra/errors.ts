export function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
  return undefined;
}

export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || "Error";
  }
  if (typeof err === "string") return err;
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    return String(err);
  }
  try {
    return JSON.stringify(err);
  } catch {
    return Object.prototype.toString.call(err);
  }
}

export function formatUncaughtError(err: unknown): string {
  if (extractErrorCode(err) === "INVALID_CONFIG") {
    return formatErrorMessage(err);
  }
  if (err instanceof Error) {
    return err.stack ?? err.message ?? err.name;
  }
  return formatErrorMessage(err);
}

/**
 * Sanitize error for user-facing responses (no stack traces or internal details).
 * Use this for HTTP responses, user messages, etc.
 * Full stack traces are still available via formatUncaughtError() for logs.
 */
export function sanitizeErrorForUser(err: unknown): string {
  if (err instanceof Error) {
    // Return only the message, never the stack trace
    return err.message || err.name || "An error occurred";
  }
  if (typeof err === "string") {
    return err;
  }
  // Avoid exposing internal structure via JSON.stringify
  return "An unexpected error occurred";
}
