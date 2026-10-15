import type { Minor, Milli, Bp } from './index';

/**
 * Rounds a number to the nearest integer using the Half-Up rule.
 * 0.5 rounds away from zero; symmetric for negative numbers:
 * 2.5 -> 3, -2.5 -> -3, 2.4 -> 2, -2.4 -> -2.
 */
export function roundHalfUp(value: number): number {
  if (value === 0) return 0;
  const rounded = value > 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
  return rounded === 0 ? 0 : rounded;
}

/**
 * Multiplies two numbers and divides by a third, rounding the result half-up.
 * Avoids cumulative rounding error.
 */
export function mulDivRound(a: number, b: number, c: number): number {
  if (c === 0) {
    throw new Error('Division by zero in mulDivRound');
  }
  return roundHalfUp((a * b) / c);
}

/**
 * Allocates an integer total (Minor) among multiple parts proportional to weights
 * using the Largest Remainder Method (Hamilton / Hare-Niemeyer).
 *
 * Guarantees that the sum of the allocated parts is strictly equal to the total,
 * with no rounding discrepancy (no missing cent, no extra cent).
 *
 * @param total - Integer total to distribute (e.g. Minor centavos)
 * @param weights - Array of non-negative weights (e.g. line totals or quantities)
 * @returns Array of integer allocations corresponding to each weight
 */
export function allocate(total: Minor, weights: number[]): Minor[] {
  if (weights.length === 0) {
    return [];
  }

  if (total === 0) {
    return new Array(weights.length).fill(0);
  }

  // Handle negative total symmetrically
  if (total < 0) {
    return allocate(-total, weights).map((part) => -part);
  }

  let effectiveWeights = weights;
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w), 0);

  if (totalWeight === 0) {
    // If all weights are zero, distribute equally
    effectiveWeights = new Array(weights.length).fill(1);
  }

  const sumWeights = effectiveWeights.reduce((sum, w) => sum + Math.max(0, w), 0);

  const integerParts: number[] = new Array(effectiveWeights.length).fill(0);
  const remainders: { index: number; remainder: number }[] = [];

  let allocatedSum = 0;

  for (let i = 0; i < effectiveWeights.length; i++) {
    const w = Math.max(0, effectiveWeights[i] ?? 0);
    const exact = (total * w) / sumWeights;
    const intPart = Math.floor(exact);
    const rem = exact - intPart;

    integerParts[i] = intPart;
    allocatedSum += intPart;
    remainders.push({ index: i, remainder: rem });
  }

  const missing = total - allocatedSum;

  // Sort descending by remainder; break ties by original index
  remainders.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.index - b.index;
  });

  for (let i = 0; i < missing; i++) {
    const item = remainders[i % remainders.length];
    if (item) {
      const idx = item.index;
      integerParts[idx] = (integerParts[idx] ?? 0) + 1;
    }
  }

  return integerParts;
}

export type { Minor, Milli, Bp };
