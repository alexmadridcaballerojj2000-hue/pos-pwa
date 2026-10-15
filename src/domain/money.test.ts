import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { roundHalfUp, mulDivRound, allocate } from './money';

describe('roundHalfUp (SPEC §6.1)', () => {
  it('rounds positive half-way values upwards (away from zero)', () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4)).toBe(2);
    expect(roundHalfUp(2.6)).toBe(3);
  });

  it('rounds negative half-way values symmetrically away from zero', () => {
    expect(roundHalfUp(-0.5)).toBe(-1);
    expect(roundHalfUp(-1.5)).toBe(-2);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(-2.4)).toBe(-2);
    expect(roundHalfUp(-2.6)).toBe(-3);
  });

  it('handles zero correctly', () => {
    expect(roundHalfUp(0)).toBe(0);
    expect(roundHalfUp(-0)).toBe(0);
  });

  it('property-based: roundHalfUp is symmetric for any number', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: -1e6, max: 1e6 }), (val) => {
        const expected = roundHalfUp(val) === 0 ? 0 : -roundHalfUp(val);
        expect(roundHalfUp(-val)).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });
});

describe('mulDivRound', () => {
  it('multiplies, divides and rounds half-up', () => {
    expect(mulDivRound(100, 15, 10)).toBe(150);
    expect(mulDivRound(1099, 1500, 10000)).toBe(165); // SPEC §6.2: 164.85 -> 165
  });

  it('throws on division by zero', () => {
    expect(() => mulDivRound(10, 20, 0)).toThrow('Division by zero in mulDivRound');
  });
});

describe('allocate (Largest Remainder Method / SPEC §6.1 & §6.2)', () => {
  it('SPEC §6.2 Golden Case: allocates 1000 across [3333, 3333, 3334] -> [333, 333, 334]', () => {
    const result = allocate(1000, [3333, 3333, 3334]);
    expect(result).toEqual([333, 333, 334]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('allocates 100 equally across 3 parts without losing 1 cent (34, 33, 33)', () => {
    const result = allocate(100, [1, 1, 1]);
    expect(result).toEqual([34, 33, 33]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('handles zero total correctly', () => {
    const result = allocate(0, [100, 200, 300]);
    expect(result).toEqual([0, 0, 0]);
  });

  it('handles negative totals symmetrically (refund prorations)', () => {
    const result = allocate(-1000, [3333, 3333, 3334]);
    expect(result).toEqual([-333, -333, -334]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(-1000);
  });

  it('handles single-item weights', () => {
    expect(allocate(450, [100])).toEqual([450]);
  });

  it('handles empty weights array', () => {
    expect(allocate(500, [])).toEqual([]);
  });

  it('handles all-zero weights by distributing equally', () => {
    const result = allocate(100, [0, 0]);
    expect(result).toEqual([50, 50]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('property-based: sum of parts is strictly equal to total for any arbitrary inputs (1000 runs)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 50 }),
        (total, weights) => {
          const parts = allocate(total, weights);
          expect(parts.length).toBe(weights.length);
          const sum = parts.reduce((acc, p) => acc + p, 0);
          expect(sum).toBe(total);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
