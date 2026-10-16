import { v7 as uuidv7, validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { UUID } from './index';

/**
 * Generate a new UUIDv7.
 * UUIDv7 embeds a Unix millisecond timestamp, providing natural temporal ordering
 * and optimal indexing performance for database keys.
 */
export function generateId(dateOrMs?: Date | number): UUID {
  if (typeof dateOrMs === 'number') {
    return uuidv7({ msecs: dateOrMs });
  }
  if (dateOrMs instanceof Date) {
    return uuidv7({ msecs: dateOrMs.getTime() });
  }
  return uuidv7();
}

export const v7 = generateId;

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
