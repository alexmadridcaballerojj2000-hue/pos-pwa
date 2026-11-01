import type { CurrencyConfig, Minor } from '@/domain';

/**
 * Returns intuitive cash denomination suggestions for a given remaining balance.
 *
 * For example, if remainingDue is $145.00:
 * Suggestions: [$150.00, $200.00, $500.00, $1000.00].
 *
 * If remainingDue is $23.50:
 * Suggestions: [$24.00, $30.00, $50.00, $100.00].
 *
 * All calculations preserve Minor integer units without float errors.
 */
export function getQuickCashOptions(
  remainingDue: Minor,
  currency: CurrencyConfig,
  maxOptions = 4,
): Minor[] {
  if (remainingDue <= 0) {
    return [];
  }

  const multiplier = 10 ** currency.decimals;
  const majorDue = remainingDue / multiplier;

  const candidateSet = new Set<number>();

  if (majorDue >= 100) {
    // For large amounts, use round 10s, 50s, 100s and bill denominations (200, 500, 1000, 2000)
    const billSteps = [10, 50, 100, 200, 500, 1000, 2000, 5000];
    for (const step of billSteps) {
      const nextVal = Math.ceil((majorDue + 0.0001) / step) * step;
      if (nextVal > majorDue) {
        candidateSet.add(nextVal);
      }
    }
  } else if (majorDue >= 20) {
    // Next whole integer if fractional
    if (Math.ceil(majorDue) > majorDue) {
      candidateSet.add(Math.ceil(majorDue));
    }
    const billSteps = [5, 10, 20, 50, 100, 200, 500];
    for (const step of billSteps) {
      const nextVal = Math.ceil((majorDue + 0.0001) / step) * step;
      if (nextVal > majorDue) {
        candidateSet.add(nextVal);
      }
    }
  } else {
    // Small amounts: next integer, 5, 10, 20, 50, 100
    if (Math.ceil(majorDue) > majorDue) {
      candidateSet.add(Math.ceil(majorDue));
    }
    const billSteps = [1, 2, 5, 10, 20, 50, 100];
    for (const step of billSteps) {
      const nextVal = Math.ceil((majorDue + 0.0001) / step) * step;
      if (nextVal > majorDue) {
        candidateSet.add(nextVal);
      }
    }
  }

  // Sort candidates ascending
  const sorted = Array.from(candidateSet).sort((a, b) => a - b);

  // Return up to maxOptions in Minor units
  return sorted.slice(0, maxOptions).map((val) => Math.round(val * multiplier));
}
