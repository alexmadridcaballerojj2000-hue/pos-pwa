import { describe, expect, it } from 'vitest';
import { getQuickCashOptions } from './quick-cash';
import { DEFAULT_CURRENCY } from '@/domain';

describe('Quick Cash Denominations (S5-T1)', () => {
  it('returns empty array when remainingDue is zero or negative', () => {
    expect(getQuickCashOptions(0, DEFAULT_CURRENCY)).toEqual([]);
    expect(getQuickCashOptions(-500, DEFAULT_CURRENCY)).toEqual([]);
  });

  it('suggests correct denominations for $145.00', () => {
    // 14500 Minor = $145.00
    const options = getQuickCashOptions(14500, DEFAULT_CURRENCY);
    // Should be 150.00, 200.00, 500.00, 1000.00
    expect(options).toEqual([15000, 20000, 50000, 100000]);
    expect(options.every((opt) => opt > 14500)).toBe(true);
  });

  it('suggests correct denominations for $23.50', () => {
    const options = getQuickCashOptions(2350, DEFAULT_CURRENCY);
    // 24.00, 25.00, 30.00, 40.00
    expect(options[0]).toBe(2400); // next whole unit
    expect(options).toEqual([2400, 2500, 3000, 4000]);
    expect(options.every((opt) => opt > 2350)).toBe(true);
  });

  it('suggests correct denominations for small amounts ($5.00)', () => {
    const options = getQuickCashOptions(500, DEFAULT_CURRENCY);
    // 6.00, 10.00, 20.00, 50.00
    expect(options).toEqual([600, 1000, 2000, 5000]);
  });
});
