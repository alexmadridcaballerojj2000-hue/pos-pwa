import type { ISODate } from '../index';

/**
 * Clock port interface to decouple domain logic from system time.
 * Injected into domain services and repositories to enable deterministic testing.
 */
export interface Clock {
  /** Returns the current Date object. */
  now(): Date;
  /** Returns the current timestamp in ISO 8601 UTC string format. */
  nowIso(): ISODate;
  /** Returns milliseconds since Unix epoch. */
  nowEpochMs(): number;
}
