/**
 * SK-003 (#29) -- Signed bundle format
 *
 * Types and stub functions for cryptographically signing skill bundles
 * to ensure supply-chain integrity. Bundles are `.tar.gz` archives
 * produced by `scripts/build-skill-bundle.sh`.
 *
 * The actual signing implementation will use Ed25519 (or similar) once
 * the key-management infrastructure is in place. These stubs establish
 * the contract so the registry, loader, and CI can be wired up now.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata attached to a signed bundle. */
export type BundleSignature = {
  /** Signing algorithm identifier (e.g. `"ed25519"`, `"sha256-rsa"`). */
  algorithm: string;
  /** Hex-encoded signature over the bundle content. */
  signature_hex: string;
  /** Identifier for the public key that can verify this signature. */
  public_key_id: string;
  /** ISO-8601 timestamp of when the signature was created. */
  signed_at: string;
};

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Sign a skill bundle tarball with the given key.
 *
 * Stub -- returns a placeholder signature. Replace with real crypto
 * once key management is available.
 *
 * @param bundlePath - Absolute path to the `.tar.gz` bundle file.
 * @param keyId - Identifier of the signing key to use.
 * @returns The signature metadata to store alongside the bundle.
 */
export async function signBundle(bundlePath: string, keyId: string): Promise<BundleSignature> {
  // TODO: read bundle bytes, compute Ed25519 signature using keyId
  void bundlePath;
  void keyId;
  throw new Error("signBundle not implemented -- awaiting key management infrastructure.");
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify a bundle's signature against the embedded metadata.
 *
 * Stub -- always throws until the signing infrastructure is in place.
 *
 * @param bundlePath - Absolute path to the `.tar.gz` bundle file.
 * @param signature - The `BundleSignature` to verify against.
 * @returns `true` if the signature is valid, `false` otherwise.
 */
export async function verifyBundleSignature(
  bundlePath: string,
  signature: BundleSignature,
): Promise<boolean> {
  // TODO: read bundle bytes, look up public key by signature.public_key_id,
  //       verify the cryptographic signature
  void bundlePath;
  void signature;
  throw new Error(
    "verifyBundleSignature not implemented -- awaiting key management infrastructure.",
  );
}
