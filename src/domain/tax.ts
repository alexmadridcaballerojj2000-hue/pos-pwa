import type { Minor, Bp } from './index';
import { mulDivRound } from './money';

export interface LineTaxResult {
  taxableBase: Minor;
  rateBp: Bp;
  net: Minor;
  tax: Minor;
  lineTotal: Minor;
}

/**
 * Calculates line tax, net base, and line total according to SPEC §6.2.
 *
 * Rules:
 * - If rateBp === 0 (exempt), tax is always 0.
 * - If pricesIncludeTax === true:
 *     net = round(taxableBase * 10000 / (10000 + rateBp))
 *     tax = taxableBase - net
 *     lineTotal = taxableBase
 * - If pricesIncludeTax === false:
 *     net = taxableBase
 *     tax = round(taxableBase * rateBp / 10000)
 *     lineTotal = taxableBase + tax
 *
 * @param taxableBase - Amount after line and order discounts in Minor units
 * @param rateBp - Tax rate in basis points (1500 = 15%)
 * @param pricesIncludeTax - Flag indicating tax-inclusive pricing
 */
export function calculateLineTax(
  taxableBase: Minor,
  rateBp: Bp,
  pricesIncludeTax: boolean,
): LineTaxResult {
  if (rateBp === 0) {
    return {
      taxableBase,
      rateBp,
      net: taxableBase,
      tax: 0,
      lineTotal: taxableBase,
    };
  }

  if (pricesIncludeTax) {
    const net = mulDivRound(taxableBase, 10000, 10000 + rateBp);
    const tax = taxableBase - net;
    return {
      taxableBase,
      rateBp,
      net,
      tax,
      lineTotal: taxableBase,
    };
  }

  const tax = mulDivRound(taxableBase, rateBp, 10000);
  return {
    taxableBase,
    rateBp,
    net: taxableBase,
    tax,
    lineTotal: taxableBase + tax,
  };
}
