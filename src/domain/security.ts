import type { UserPin } from './types';

export const DEFAULT_PBKDF2_ITERATIONS = 210000;

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hash a numeric or alphanumeric PIN using PBKDF2-SHA256 with WebCrypto.
 * Meets SPEC §11 requirement: >= 210,000 iterations and 16-byte cryptographically secure random salt.
 */
export async function hashPin(
  pin: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
  saltBytes?: Uint8Array,
): Promise<UserPin> {
  if (!pin || pin.trim().length === 0) {
    throw new Error('PIN cannot be empty');
  }

  const salt = saltBytes ?? crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as ArrayBufferView,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256, // 32 bytes (256 bits)
  );

  return {
    hash: bufferToHex(derivedBits),
    salt: bufferToHex(salt),
    iterations,
  };
}

/**
 * Verify a candidate PIN against a stored UserPin record.
 * Uses timing-safe constant-time string comparison to prevent timing attacks.
 */
export async function verifyPin(pin: string, stored: UserPin): Promise<boolean> {
  if (!pin || !stored || !stored.hash || !stored.salt) {
    return false;
  }

  try {
    const saltBytes = hexToUint8Array(stored.salt);
    const candidate = await hashPin(pin, stored.iterations, saltBytes);

    // Constant-time comparison
    if (candidate.hash.length !== stored.hash.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < candidate.hash.length; i++) {
      mismatch |= candidate.hash.charCodeAt(i) ^ stored.hash.charCodeAt(i);
    }

    return mismatch === 0;
  } catch {
    return false;
  }
}
