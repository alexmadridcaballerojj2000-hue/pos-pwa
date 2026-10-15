import { v7 as uuidv7, validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { UUID } from './index';

/**
 * Generate a new UUIDv7.
 * UUIDv7 embeds a Unix millisecond timestamp, providing natural temporal ordering
 * and optimal indexing performance for database keys.
 */
export function generateId(): UUID {
  return uuidv7();
}

/**
 * Validate whether a string is a well-formed UUID (any version).
 */
export function isValidUuid(id: string): boolean {
  return uuidValidate(id);
}

/**
 * Validate whether a string is specifically a valid UUIDv7.
 */
export function isUuidV7(id: string): boolean {
  return uuidValidate(id) && uuidVersion(id) === 7;
}
