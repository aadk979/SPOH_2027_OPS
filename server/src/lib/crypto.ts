import { createHash, randomBytes, randomInt } from 'node:crypto';

/** 6-digit numeric login code, zero-padded (FR-AUTH-1). */
export function generateLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** 256-bit random session token, URL-safe. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only hashes are stored; codes are hashed with the person id so equal codes never collide. */
export function hashToken(value: string, salt = ''): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}
