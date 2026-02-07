/**
 * TOOLS-005 (#41) -- Browser credential vault
 *
 * Secure storage and retrieval of browser credentials and session data.
 * Passwords are never stored in plaintext -- only vault references
 * (e.g. `vault://domain/password`) are persisted. Actual secrets are
 * resolved at runtime through an external secret store.
 *
 * @see ./browser-runner.ts
 * @module
 */

// ---------------------------------------------------------------------------
// Credential
// ---------------------------------------------------------------------------

/**
 * A stored browser credential.
 *
 * The `password_ref` field is a vault reference, **not** a plaintext password.
 * The runner resolves it at execution time through the configured secret
 * provider.
 */
export type BrowserCredential = {
  /** The domain this credential is scoped to (e.g. `"github.com"`). */
  domain: string;

  /** The login username or email. */
  username: string;

  /**
   * Vault reference to the password/secret.
   * Format: `vault://<domain>/<key>` (resolved at runtime).
   * **Never** contains a plaintext password.
   */
  password_ref: string;

  /** Optional TOTP / 2FA vault reference for sites requiring MFA. */
  totp_ref?: string;

  /** ISO-8601 timestamp of when this credential was last updated. */
  updated_at: string;

  /** Human-readable label (e.g. `"Work GitHub account"`). */
  label?: string;
};

// ---------------------------------------------------------------------------
// Session data
// ---------------------------------------------------------------------------

/**
 * Serialized browser session state for a domain (cookies, localStorage
 * snapshot, etc.). Enables resuming authenticated sessions without
 * re-entering credentials.
 */
export type BrowserSessionData = {
  /** Domain the session belongs to. */
  domain: string;

  /**
   * Serialized cookie jar (Playwright `storageState` JSON).
   * Stored encrypted at rest.
   */
  cookies_encrypted: string;

  /**
   * Serialized localStorage entries (key-value pairs), encrypted at rest.
   */
  local_storage_encrypted?: string;

  /** ISO-8601 timestamp of when the session was captured. */
  captured_at: string;

  /** ISO-8601 timestamp after which this session should be considered stale. */
  expires_at?: string;
};

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

/**
 * Manages persistence of browser sessions on a per-domain basis.
 *
 * Implementations may write to disk (encrypted), an OS keychain, or a
 * remote vault -- the interface is deliberately storage-agnostic.
 */
export class BrowserSessionStore {
  /**
   * Save (or overwrite) the session data for a domain.
   *
   * The implementation should encrypt the data before persisting.
   */
  async save(_session: BrowserSessionData): Promise<void> {
    // TODO: encrypt and persist session data
    throw new Error("BrowserSessionStore.save not implemented");
  }

  /**
   * Load the session data for a domain.
   *
   * @returns The decrypted session data, or `null` if no session exists
   *          or the session has expired.
   */
  async load(_domain: string): Promise<BrowserSessionData | null> {
    // TODO: load and decrypt session data, check expiry
    throw new Error("BrowserSessionStore.load not implemented");
  }

  /**
   * Delete the stored session for a domain.
   *
   * Should be called when the session is known to be invalid (e.g. after
   * a logout or credential rotation).
   */
  async delete(_domain: string): Promise<void> {
    // TODO: remove persisted session data
    throw new Error("BrowserSessionStore.delete not implemented");
  }

  /**
   * List all domains that have a stored session.
   *
   * Useful for audit / cleanup UIs.
   */
  async listDomains(): Promise<string[]> {
    // TODO: enumerate stored session domains
    throw new Error("BrowserSessionStore.listDomains not implemented");
  }
}
