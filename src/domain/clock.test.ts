import { describe, it, expect } from 'vitest';
import { SystemClock, FakeClock } from './clock';

describe('SystemClock', () => {
  it('returns valid Date, ISO string, and epoch milliseconds', () => {
    const clock = new SystemClock();
    const now = clock.now();
    const nowIso = clock.nowIso();
    const nowEpoch = clock.nowEpochMs();

    expect(now).toBeInstanceOf(Date);
    expect(nowIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(nowEpoch).toBeGreaterThan(0);
  });
});

describe('FakeClock', () => {
  it('initializes to specified default time', () => {
    const clock = new FakeClock('2026-05-15T10:00:00.000Z');
    expect(clock.nowIso()).toBe('2026-05-15T10:00:00.000Z');
    expect(clock.nowEpochMs()).toBe(new Date('2026-05-15T10:00:00.000Z').getTime());

    const fromDate = new FakeClock(new Date('2026-06-01T00:00:00.000Z'));
    expect(fromDate.nowIso()).toBe('2026-06-01T00:00:00.000Z');

    const fromNumber = new FakeClock(1700000000000);
    expect(fromNumber.nowEpochMs()).toBe(1700000000000);
  });

  it('can advance time forward by milliseconds', () => {
    const clock = new FakeClock('2026-01-01T00:00:00.000Z');
    clock.advance(5000); // 5 seconds
    expect(clock.nowIso()).toBe('2026-01-01T00:00:05.000Z');

    clock.advance(60000); // 1 minute
    expect(clock.nowIso()).toBe('2026-01-01T00:01:05.000Z');
  });

  it('throws error when attempting to advance negative milliseconds', () => {
    const clock = new FakeClock();
    expect(() => clock.advance(-100)).toThrow('Cannot advance clock backwards');
  });

  it('can explicitly set time to a new date or timestamp', () => {
    const clock = new FakeClock('2026-01-01T00:00:00.000Z');
    clock.set('2026-12-31T23:59:59.000Z');
    expect(clock.nowIso()).toBe('2026-12-31T23:59:59.000Z');

    clock.set(new Date('2027-01-01T12:00:00.000Z'));
    expect(clock.nowIso()).toBe('2027-01-01T12:00:00.000Z');

    clock.set(1000);
    expect(clock.nowEpochMs()).toBe(1000);
  });
});
