/**
 * Credential Encryption Service
 *
 * Provides AES-256-GCM encryption for sensitive credentials with
 * per-customer key derivation for additional isolation.
 */

import crypto from 'node:crypto';

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32;

// Environment
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY;

// Types
export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  keyVersion: number;
}

export interface EncryptedCredential {
  encryptedHex: string;
  ivHex: string;
  tagHex: string;
  keyVersion: number;
}

/**
 * Get the master encryption key from environment
 */
function getMasterKey(): Buffer {
  if (!MASTER_KEY) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
  }

  // Master key should be base64-encoded 32 bytes
  const keyBuffer = Buffer.from(MASTER_KEY, 'base64');

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes (256 bits) base64-encoded');
  }

  return keyBuffer;
}

/**
 * Derive a customer-specific encryption key using HKDF
 * This ensures that even if one customer's data is compromised,
 * other customers' data remains protected.
 */
function deriveCustomerKey(customerId: string, keyVersion: number = 1): Buffer {
  const masterKey = getMasterKey();

  // Create salt from customer ID and key version
  const salt = crypto
    .createHash('sha256')
    .update(`openclaw:v${keyVersion}:${customerId}`)
    .digest();

  // Use HKDF to derive customer-specific key
  return crypto.hkdfSync('sha256', masterKey, salt, 'customer-credentials', KEY_LENGTH);
}

/**
 * Encrypt a credential value
 */
export function encryptCredential(value: string, customerId: string, keyVersion: number = 1): EncryptedData {
  if (!value) {
    throw new Error('Cannot encrypt empty value');
  }

  const key = deriveCustomerKey(customerId, keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv,
    tag,
    keyVersion,
  };
}

/**
 * Decrypt a credential value
 */
export function decryptCredential(
  encrypted: Buffer,
  iv: Buffer,
  tag: Buffer,
  customerId: string,
  keyVersion: number = 1
): string {
  const key = deriveCustomerKey(customerId, keyVersion);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Encrypt credential and return hex-encoded strings for database storage
 */
export function encryptForStorage(value: string, customerId: string): EncryptedCredential {
  const { encrypted, iv, tag, keyVersion } = encryptCredential(value, customerId);

  return {
    encryptedHex: encrypted.toString('hex'),
    ivHex: iv.toString('hex'),
    tagHex: tag.toString('hex'),
    keyVersion,
  };
}

/**
 * Decrypt credential from hex-encoded database values
 */
export function decryptFromStorage(
  encryptedHex: string,
  ivHex: string,
  tagHex: string,
  customerId: string,
  keyVersion: number = 1
): string {
  return decryptCredential(
    Buffer.from(encryptedHex, 'hex'),
    Buffer.from(ivHex, 'hex'),
    Buffer.from(tagHex, 'hex'),
    customerId,
    keyVersion
  );
}

/**
 * Generate a new API key for a customer
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  // Generate 32 random bytes and encode as base64url
  const randomBytes = crypto.randomBytes(32);
  const key = `oc_${randomBytes.toString('base64url')}`;

  // Create SHA-256 hash for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  // Store prefix for identification (first 11 chars: "oc_" + 8)
  const prefix = key.substring(0, 11);

  return { key, hash, prefix };
}

/**
 * Hash an API key for comparison
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Use timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}

/**
 * Generate a random encryption key (for initial setup)
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Mask a credential value for display
 */
export function maskCredential(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }

  const prefix = value.substring(0, visibleChars);
  const suffix = value.substring(value.length - visibleChars);
  const masked = '*'.repeat(Math.min(value.length - visibleChars * 2, 20));

  return `${prefix}${masked}${suffix}`;
}
