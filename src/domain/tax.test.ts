import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateLineTax } from './tax';

describe('calculateLineTax (SPEC §6.2)', () => {
  describe('Golden Cases (SPEC §6.2)', () => {
    it('Golden Case 1: Tax included, 15% (1500 Bp): 11500 -> net 10000, tax 1500', () => {
      const result = calculateLineTax(11500, 1500, true);
      expect(result.net).toBe(10000);
      expect(result.tax).toBe(1500);
      expect(result.lineTotal).toBe(11500);
      expect(result.net + result.tax).toBe(result.taxableBase);
    });

    it('Golden Case 2: Tax included, 15% (1500 Bp): 10000 -> net 8696, tax 1304', () => {
      const result = calculateLineTax(10000, 1500, true);
      expect(result.net).toBe(8696);
      expect(result.tax).toBe(1304);
      expect(result.lineTotal).toBe(10000);
      expect(result.net + result.tax).toBe(result.taxableBase);
    });

    it('Golden Case 3: Tax excluded, 15% (1500 Bp): 1099 -> tax 165 (164.85 rounded half-up)', () => {
      const result = calculateLineTax(1099, 1500, false);
      expect(result.tax).toBe(165);
      expect(result.net).toBe(1099);
      expect(result.lineTotal).toBe(1264); // 1099 + 165
    });

    it('Golden Case 4: Tax exempt (rateBp = 0): tax is always 0', () => {
      const resultIncluded = calculateLineTax(5000, 0, true);
      expect(resultIncluded.tax).toBe(0);
      expect(resultIncluded.net).toBe(5000);
      expect(resultIncluded.lineTotal).toBe(5000);

      const resultExcluded = calculateLineTax(5000, 0, false);
      expect(resultExcluded.tax).toBe(0);
      expect(resultExcluded.net).toBe(5000);
      expect(resultExcluded.lineTotal).toBe(5000);
    });
  });

  describe('Property-Based Invariants (fast-check)', () => {
    it('Invariant 1: When tax is included, net + tax strictly equals taxableBase', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.integer({ min: 0, max: 10_000 }), // 0% to 100%
          (base, rateBp) => {
            const result = calculateLineTax(base, rateBp, true);
            expect(result.net + result.tax).toBe(base);
            expect(result.lineTotal).toBe(base);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('Invariant 2: When tax is excluded, lineTotal strictly equals taxableBase + tax', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.integer({ min: 0, max: 10_000 }),
          (base, rateBp) => {
            const result = calculateLineTax(base, rateBp, false);
            expect(result.lineTotal).toBe(base + result.tax);
            expect(result.net).toBe(base);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('Invariant 3: Tax is always 0 whenever rateBp is 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.boolean(),
          (base, pricesIncludeTax) => {
            const result = calculateLineTax(base, 0, pricesIncludeTax);
            expect(result.tax).toBe(0);
            expect(result.net).toBe(base);
            expect(result.lineTotal).toBe(base);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
