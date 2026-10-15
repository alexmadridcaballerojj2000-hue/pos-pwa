import type { ISODate } from './index';
import type { Clock } from './ports/clock';

/**
 * Production implementation of Clock using the runtime environment time.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIso(): ISODate {
    return new Date().toISOString();
  }

  nowEpochMs(): number {
    return new Date().getTime();
  }
}

/**
 * Deterministic Clock implementation for unit, integration, and property tests.
 */
export class FakeClock implements Clock {
  private currentMs: number;

  constructor(initial: Date | ISODate | number = '2026-01-01T12:00:00.000Z') {
    if (typeof initial === 'number') {
      this.currentMs = initial;
    } else if (typeof initial === 'string') {
      this.currentMs = new Date(initial).getTime();
    } else {
      this.currentMs = initial.getTime();
    }
  }

  now(): Date {
    return new Date(this.currentMs);
  }

  nowIso(): ISODate {
    return new Date(this.currentMs).toISOString();
  }

  nowEpochMs(): number {
    return this.currentMs;
  }

  /**
   * Advance the fake clock by a specified duration in milliseconds.
   */
  advance(ms: number): void {
    if (ms < 0) {
      throw new Error('Cannot advance clock backwards');
    }
    this.currentMs += ms;
  }

  /**
   * Set the fake clock to a specific point in time.
   */
  set(target: Date | ISODate | number): void {
    if (typeof target === 'number') {
      this.currentMs = target;
    } else if (typeof target === 'string') {
      this.currentMs = new Date(target).getTime();
    } else {
      this.currentMs = target.getTime();
    }
  }
}
