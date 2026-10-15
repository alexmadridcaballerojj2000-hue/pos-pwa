import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateLineDiscount,
  calculateOrderDiscountTotal,
  prorateOrderDiscount,
} from './discount';

describe('Discount Engine (SPEC §6.2)', () => {
  describe('Line Discounts', () => {
    it('applies percent discount correctly (10% = 1000 Bp on 10000 -> 1000)', () => {
      const result = calculateLineDiscount(10000, { type: 'percent', value: 1000 });
      expect(result.lineDiscount).toBe(1000);
      expect(result.afterLine).toBe(9000);
    });

    it('applies fixed discount correctly (500 Minor on 2500 -> 500)', () => {
      const result = calculateLineDiscount(2500, { type: 'fixed', value: 500 });
      expect(result.lineDiscount).toBe(500);
      expect(result.afterLine).toBe(2000);
    });

    it('caps fixed discount at lineBase (never results in negative afterLine)', () => {
      const result = calculateLineDiscount(1000, { type: 'fixed', value: 2500 });
      expect(result.lineDiscount).toBe(1000);
      expect(result.afterLine).toBe(0);
    });

    it('returns zero discount when no discount is specified', () => {
      const result = calculateLineDiscount(4000, undefined);
      expect(result.lineDiscount).toBe(0);
      expect(result.afterLine).toBe(4000);
    });
  });

  describe('Order Discounts & Proration', () => {
    it('SPEC §6.2 Golden Case: prorate 1000 discount across [3333, 3333, 3334] -> [333, 333, 334]', () => {
      const shares = prorateOrderDiscount(1000, [3333, 3333, 3334]);
      expect(shares).toEqual([333, 333, 334]);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
    });

    it('calculates order discount percent on sum of lines', () => {
      const discountTotal = calculateOrderDiscountTotal(20000, { type: 'percent', value: 1500 });
      expect(discountTotal).toBe(3000); // 15% of 20000
    });

    it('caps order fixed discount at sumAfterLine', () => {
      const discountTotal = calculateOrderDiscountTotal(5000, { type: 'fixed', value: 8000 });
      expect(discountTotal).toBe(5000);
    });
  });

  describe('Property-Based Invariants (fast-check)', () => {
    it('Invariant: sum of order discount shares strictly equals total order discount (1000 runs)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 100, max: 100_000 }), { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 10_000 }), // percentage in Bp (up to 100%)
          (lines, discountBp) => {
            const sumAfterLine = lines.reduce((a, b) => a + b, 0);
            const totalOrderDiscount = calculateOrderDiscountTotal(sumAfterLine, {
              type: 'percent',
              value: discountBp,
            });

            const shares = prorateOrderDiscount(totalOrderDiscount, lines);
            const sharesSum = shares.reduce((a, b) => a + b, 0);

            expect(sharesSum).toBe(totalOrderDiscount);
            expect(shares.length).toBe(lines.length);

            // Each share cannot exceed the line's amount
            for (let i = 0; i < lines.length; i++) {
              expect(shares[i]).toBeLessThanOrEqual(lines[i]!);
            }
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('Invariant: line afterLine is always between 0 and lineBase', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.constantFrom('percent', 'fixed'),
          fc.integer({ min: 0, max: 2_000_000 }),
          (lineBase, type, value) => {
            const result = calculateLineDiscount(lineBase, {
              type: type as 'percent' | 'fixed',
              value,
            });
            expect(result.afterLine).toBeGreaterThanOrEqual(0);
            expect(result.afterLine).toBeLessThanOrEqual(lineBase);
            expect(result.lineDiscount + result.afterLine).toBe(lineBase);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
