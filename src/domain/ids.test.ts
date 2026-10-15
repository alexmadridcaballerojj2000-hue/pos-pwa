import { describe, it, expect } from 'vitest';
import { generateId, isValidUuid, isUuidV7 } from './ids';

describe('UUIDv7 Generator & Validator', () => {
  it('generates a valid UUID string', () => {
    const id = generateId();
    expect(isValidUuid(id)).toBe(true);
  });

  it('generates specifically a UUIDv7', () => {
    const id = generateId();
    expect(isUuidV7(id)).toBe(true);
  });

  it('validates malformed UUIDs as false', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('')).toBe(false);
    expect(isUuidV7('12345')).toBe(false);
  });

  it('generates distinct IDs on consecutive invocations', () => {
    const ids = Array.from({ length: 100 }, () => generateId());
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(100);
  });

  it('maintains monotonic time ordering for sequential IDs', async () => {
    const id1 = generateId();
    // Tiny delay to ensure subsequent millisecond tick
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = generateId();

    expect(id2 > id1).toBe(true);
  });
});
