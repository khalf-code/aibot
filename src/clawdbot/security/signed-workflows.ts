/**
 * SEC-006 (#80) — Signed workflow definitions
 *
 * Cryptographic signing and verification for workflow definitions.
 * Signed workflows carry a detached signature that attests to the
 * integrity and authorship of the workflow JSON. This prevents
 * tampering and enables trust decisions before execution.
 *
 * The signing infrastructure reuses the same key-management approach
 * as the skill bundle signing (SK-003) but operates on serialised
 * workflow JSON rather than tarball archives.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A cryptographic signature attached to a workflow definition. */
export type WorkflowSignature = {
  /** Signing algorithm identifier (e.g. `"ed25519"`, `"sha256-rsa"`). */
  algorithm: string;
  /** Hex-encoded signature over the canonical workflow JSON. */
  signatureHex: string;
  /** Identifier of the public key that can verify this signature. */
  publicKeyId: string;
  /** ISO-8601 timestamp of when the signature was created. */
  signedAt: string;
  /** SHA-256 hex digest of the canonical workflow content. */
  contentHash: string;
};

/** The workflow payload — a JSON-serialisable definition. */
export type WorkflowDefinition = {
  /** Unique workflow identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Semantic version. */
  version: string;
  /** Serialised workflow body (e.g. n8n JSON, custom DSL). */
  body: Record<string, unknown>;
};

/** A workflow definition bundled with its cryptographic signature. */
export type SignedWorkflow = {
  /** The workflow definition. */
  workflow: WorkflowDefinition;
  /** The detached signature. */
  signature: WorkflowSignature;
};

/** Outcome of a signature verification check. */
export type VerificationResult = {
  /** Whether the signature is valid. */
  valid: boolean;
  /** Human-readable explanation of the result. */
  reason: string;
  /** The public key ID that was used for verification (if any). */
  publicKeyId?: string;
  /** ISO-8601 timestamp of when the verification was performed. */
  verifiedAt: string;
};

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Sign a workflow definition with the given key.
 *
 * Stub -- returns a placeholder signature. Replace with real crypto
 * once the key-management infrastructure is in place.
 *
 * @param workflow - The workflow definition to sign.
 * @param keyId   - Identifier of the signing key to use.
 * @returns A signed workflow containing both the definition and signature.
 */
export async function signWorkflow(
  workflow: WorkflowDefinition,
  keyId: string,
): Promise<SignedWorkflow> {
  // TODO: serialise workflow to canonical JSON, compute Ed25519 signature
  void workflow;
  void keyId;
  throw new Error("signWorkflow not implemented -- awaiting key management infrastructure.");
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify that a signed workflow's signature is valid and the content
 * has not been tampered with.
 *
 * Stub -- always throws until the signing infrastructure is in place.
 *
 * @param signedWorkflow - The signed workflow to verify.
 * @returns Verification result with validity flag and explanation.
 */
export async function verifyWorkflow(signedWorkflow: SignedWorkflow): Promise<VerificationResult> {
  // TODO: look up public key by signedWorkflow.signature.publicKeyId,
  //       recompute content hash, verify cryptographic signature
  void signedWorkflow;
  throw new Error("verifyWorkflow not implemented -- awaiting key management infrastructure.");
}
