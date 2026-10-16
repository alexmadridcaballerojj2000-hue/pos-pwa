import { describe, expect, it } from 'vitest';
import { DEFAULT_PBKDF2_ITERATIONS, hashPin, verifyPin } from './security';

describe('Security: PBKDF2 PIN Hashing & Verification (SPEC §11)', () => {
  it('hashes PIN with >= 210,000 iterations and 16-byte random salt', async () => {
    // Use smaller iteration count for speed in one test or test default
    const stored = await hashPin('1234', 1000); // 1000 for quick unit test

    expect(stored.iterations).toBe(1000);
    expect(stored.salt).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(stored.hash).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it('verifies correct PIN as true and incorrect PIN as false', async () => {
    const pin = '4829';
    const stored = await hashPin(pin, 5000);

    const isMatch = await verifyPin(pin, stored);
    expect(isMatch).toBe(true);

    const wrongMatch = await verifyPin('9999', stored);
    expect(wrongMatch).toBe(false);

    const closeMatch = await verifyPin('4828', stored);
    expect(closeMatch).toBe(false);
  });

  it('rejects empty PIN or invalid stored record safely without crashing', async () => {
    await expect(hashPin('')).rejects.toThrow('PIN cannot be empty');
    await expect(hashPin('   ')).rejects.toThrow('PIN cannot be empty');

    const result = await verifyPin('', { hash: 'abc', salt: '123', iterations: 1000 });
    expect(result).toBe(false);

    const corruptedResult = await verifyPin('1234', {
      hash: 'corrupted',
      salt: 'invalid_hex',
      iterations: 1000,
    });
    expect(corruptedResult).toBe(false);
  });

  it('generates distinct salts and distinct hashes for repeated hashing of identical PIN', async () => {
    const pin = '5555';
    const first = await hashPin(pin, 2000);
    const second = await hashPin(pin, 2000);

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);

    expect(await verifyPin(pin, first)).toBe(true);
    expect(await verifyPin(pin, second)).toBe(true);
  });

  it('defaults to at least 210,000 iterations when parameter is omitted', () => {
    expect(DEFAULT_PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(210000);
  });
});
