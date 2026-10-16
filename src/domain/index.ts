/**
 * Domain layer entrypoint.
 * Pure TypeScript: No React, No Dexie, No fetch, No Date.now().
 */

export type Minor = number; // Minor currency unit (cents, integer)
export type Milli = number; // Milli quantity unit (1 unit = 1000, integer)
export type Bp = number; // Basis points (1500 = 15%, integer)
export type UUID = string; // UUIDv7
export type ISODate = string; // ISO 8601 UTC

export * from './format';
export * from './ports/clock';
export * from './clock';
export * from './ids';
export * from './money';
export * from './tax';
export * from './discount';
export * from './calculator';
export * from './cart';
export * from './payments';
export * from './types';
