/**
 * SEC-009 (#83) — SSO integration stub
 *
 * Types and service interface for Single Sign-On (SSO) integration.
 * Supports pluggable identity providers (SAML, OIDC, OAuth 2.0) so
 * that Clawdbot can authenticate users against an organisation's
 * existing identity infrastructure.
 *
 * This module defines the contract; concrete provider implementations
 * (Okta, Azure AD, Google Workspace, etc.) will live in separate files.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported SSO protocol / provider type. */
export type SsoProviderType = "saml" | "oidc" | "oauth2";

/** Descriptor for a configured SSO identity provider. */
export type SsoProvider = {
  /** Unique identifier for this provider configuration. */
  id: string;
  /** Human-readable display name (e.g. `"Acme Corp Okta"`). */
  name: string;
  /** SSO protocol type. */
  type: SsoProviderType;
  /** Whether this provider is currently enabled. */
  enabled: boolean;
  /** Provider-specific metadata (issuer URL, client ID, etc.). */
  metadata: Record<string, unknown>;
};

/** Configuration required to initialise an SSO provider. */
export type SsoConfig = {
  /** The provider to configure. */
  provider: SsoProvider;
  /** OAuth 2.0 / OIDC client ID. */
  clientId: string;
  /** OAuth 2.0 / OIDC client secret. Stored encrypted at rest. */
  clientSecret: string;
  /** Redirect URI after authentication. */
  redirectUri: string;
  /** Requested scopes (e.g. `["openid", "profile", "email"]`). */
  scopes: string[];
  /** SAML-specific: IdP metadata URL. */
  idpMetadataUrl?: string;
};

/** An active SSO session for an authenticated user. */
export type SsoSession = {
  /** Unique session identifier. */
  sessionId: string;
  /** Authenticated user's unique identifier from the IdP. */
  userId: string;
  /** User's email address (from IdP claims). */
  email: string;
  /** User's display name (from IdP claims). */
  displayName: string;
  /** The SSO provider that authenticated this session. */
  providerId: string;
  /** ISO-8601 timestamp of when the session was created. */
  createdAt: string;
  /** ISO-8601 timestamp of when the session expires. */
  expiresAt: string;
  /** Raw IdP claims / attributes for downstream use. */
  claims: Record<string, unknown>;
};

/** The result of an SSO authentication attempt. */
export type SsoAuthResult = {
  /** Whether authentication succeeded. */
  success: boolean;
  /** The session, if authentication succeeded. */
  session?: SsoSession;
  /** Error message, if authentication failed. */
  error?: string;
  /** The provider that was used. */
  providerId: string;
};

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/**
 * SSO service contract.
 *
 * Implementations handle the protocol-specific handshake (SAML assertion
 * parsing, OIDC token exchange, OAuth 2.0 code flow) and produce
 * normalised sessions.
 */
export type SsoService = {
  /**
   * Initiate the SSO login flow. Returns a URL the user should be
   * redirected to for authentication.
   *
   * @param providerId - The SSO provider to use.
   * @param state      - Opaque state parameter for CSRF protection.
   * @returns The IdP login URL.
   */
  initiateLogin(providerId: string, state: string): Promise<string>;

  /**
   * Complete the SSO login by exchanging the callback parameters
   * (code, assertion, etc.) for a session.
   *
   * @param providerId   - The SSO provider that issued the callback.
   * @param callbackData - Raw callback query / form parameters.
   * @returns The authentication result.
   */
  handleCallback(providerId: string, callbackData: Record<string, string>): Promise<SsoAuthResult>;

  /**
   * Validate an existing session — check expiry, refresh tokens if needed.
   *
   * @param sessionId - The session to validate.
   * @returns The refreshed session, or null if the session is invalid / expired.
   */
  validateSession(sessionId: string): Promise<SsoSession | null>;

  /**
   * Terminate an SSO session (logout).
   *
   * @param sessionId - The session to terminate.
   */
  logout(sessionId: string): Promise<void>;

  /**
   * List all configured SSO providers.
   */
  listProviders(): Promise<SsoProvider[]>;
};
