import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../config.js';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** A keyed, non-reversible correlation value for identifiers and source metadata. */
export function privacyHash(value: string, config: AppConfig): string {
  return createHmac('sha256', config.AUDIT_HASH_KEY).update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * AES-256-GCM is used only as a local/dev envelope implementation. Production
 * deployments must source the material from an approved KMS/envelope service.
 */
export function encryptField(plaintext: string, config: AppConfig): string {
  const key = Buffer.from(config.FIELD_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw new Error('Invalid FIELD_ENCRYPTION_KEY material');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function decryptField(payload: string, config: AppConfig): string {
  const key = Buffer.from(config.FIELD_ENCRYPTION_KEY, 'base64');
  const packed = Buffer.from(payload, 'base64url');
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function secureEquals(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
