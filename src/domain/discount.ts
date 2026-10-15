import type { Minor, UUID } from './index';
import { mulDivRound, allocate } from './money';

export interface Discount {
  type: 'percent' | 'fixed';
  /**
   * For 'percent', value is in basis points (Bp), e.g. 1000 = 10%, 1500 = 15%.
   * For 'fixed', value is in minor currency units (Minor), e.g. 500 = $5.00.
   */
  value: number;
  reason?: string;
  approvedBy?: UUID;
}

export interface LineDiscountResult {
  lineBase: Minor;
  lineDiscount: Minor;
  afterLine: Minor;
}

/**
 * Calculates discount on an individual line according to SPEC §6.2.
 *
 * Rules:
 * - 'percent': round(lineBase * bp / 10000)
 * - 'fixed': min(fixed, lineBase)
 * - afterLine = lineBase - lineDiscount
 */
export function calculateLineDiscount(lineBase: Minor, discount?: Discount): LineDiscountResult {
  if (!discount || lineBase <= 0) {
    return {
      lineBase,
      lineDiscount: 0,
      afterLine: Math.max(0, lineBase),
    };
  }

  let lineDiscount = 0;
  if (discount.type === 'percent') {
    const bp = Math.max(0, discount.value);
    lineDiscount = mulDivRound(lineBase, bp, 10000);
  } else if (discount.type === 'fixed') {
    lineDiscount = Math.max(0, discount.value);
  }

  lineDiscount = Math.min(lineDiscount, lineBase);
  const afterLine = lineBase - lineDiscount;

  return {
    lineBase,
    lineDiscount,
    afterLine,
  };
}

/**
 * Calculates total order discount across the sum of lines after individual discounts.
 * Capped at sumAfterLine.
 */
export function calculateOrderDiscountTotal(sumAfterLine: Minor, discount?: Discount): Minor {
  if (!discount || sumAfterLine <= 0) {
    return 0;
  }

  let orderDiscount = 0;
  if (discount.type === 'percent') {
    const bp = Math.max(0, discount.value);
    orderDiscount = mulDivRound(sumAfterLine, bp, 10000);
  } else if (discount.type === 'fixed') {
    orderDiscount = Math.max(0, discount.value);
  }

  return Math.min(orderDiscount, sumAfterLine);
}

/**
 * Prorates order discount across lines using the Largest Remainder Method (allocate).
 * Guarantees sum of shares strictly equals totalOrderDiscount.
 */
export function prorateOrderDiscount(
  totalOrderDiscount: Minor,
  afterLineAmounts: Minor[],
): Minor[] {
  if (afterLineAmounts.length === 0 || totalOrderDiscount <= 0) {
    return new Array(afterLineAmounts.length).fill(0);
  }

  return allocate(totalOrderDiscount, afterLineAmounts);
}
