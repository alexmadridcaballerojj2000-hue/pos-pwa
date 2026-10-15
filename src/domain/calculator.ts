import type { Minor, Milli, Bp, UUID } from './index';
import { mulDivRound } from './money';
import {
  calculateLineDiscount,
  calculateOrderDiscountTotal,
  prorateOrderDiscount,
  type Discount,
} from './discount';
import { calculateLineTax } from './tax';

export interface CartItemInput {
  lineId: UUID;
  productId: UUID;
  sku: string;
  name: string;
  qty: Milli;
  unitPrice: Minor;
  taxRateId: UUID;
  taxRateBp: Bp;
  discount?: Discount;
  note?: string;
  custom?: Record<string, unknown>;
}

export interface SaleLine {
  lineId: UUID;
  productId: UUID;
  sku: string;
  name: string;
  qty: Milli;
  unitPrice: Minor;
  discount?: Discount;
  taxRateId: UUID;
  taxRateBp: Bp;
  lineBase: Minor;
  lineDiscount: Minor;
  orderDiscountShare: Minor;
  taxableBase: Minor;
  tax: Minor;
  lineTotal: Minor;
  note?: string;
  custom: Record<string, unknown>;
}

export interface TaxBreakdownEntry {
  taxRateId: UUID;
  rateBp: Bp;
  base: Minor;
  tax: Minor;
}

export interface SaleTotals {
  subtotal: Minor;
  lineDiscounts: Minor;
  orderDiscount: Minor;
  tax: Minor;
  roundingAdjustment: Minor;
  total: Minor;
  taxBreakdown: TaxBreakdownEntry[];
}

export interface CalculationResult {
  lines: SaleLine[];
  totals: SaleTotals;
}

/**
 * Calculates all lines and sale totals according to the strict order of SPEC §6.2:
 * 1. lineBase = round(unitPrice * qty / 1000)
 * 2. lineDiscount (percent or fixed capped at lineBase)
 * 3. afterLine = lineBase - lineDiscount
 * 4. orderDiscount prorated with allocate()
 * 5. taxableBase = afterLine - orderDiscountShare
 * 6. tax and lineTotal according to pricesIncludeTax
 * 7. totals: subtotal, lineDiscounts, orderDiscount, tax, total, taxBreakdown
 */
export function calculateSale(
  items: CartItemInput[],
  orderDiscount?: Discount,
  pricesIncludeTax = true,
  roundingAdjustment = 0,
): CalculationResult {
  if (items.length === 0) {
    return {
      lines: [],
      totals: {
        subtotal: 0,
        lineDiscounts: 0,
        orderDiscount: 0,
        tax: 0,
        roundingAdjustment: 0,
        total: 0,
        taxBreakdown: [],
      },
    };
  }

  // Steps 1, 2, 3: lineBase, lineDiscount, afterLine
  const preLines = items.map((item) => {
    const lineBase = mulDivRound(item.unitPrice, item.qty, 1000);
    const { lineDiscount, afterLine } = calculateLineDiscount(lineBase, item.discount);
    return {
      item,
      lineBase,
      lineDiscount,
      afterLine,
    };
  });

  // Step 4: Order discount and proration
  const sumAfterLine = preLines.reduce((acc, l) => acc + l.afterLine, 0);
  const totalOrderDiscount = calculateOrderDiscountTotal(sumAfterLine, orderDiscount);
  const orderShares = prorateOrderDiscount(
    totalOrderDiscount,
    preLines.map((l) => l.afterLine),
  );

  // Steps 5 & 6: taxableBase, tax, lineTotal
  const lines: SaleLine[] = preLines.map((l, index) => {
    const orderDiscountShare = orderShares[index] ?? 0;
    const taxableBase = Math.max(0, l.afterLine - orderDiscountShare);

    const taxResult = calculateLineTax(taxableBase, l.item.taxRateBp, pricesIncludeTax);

    return {
      lineId: l.item.lineId,
      productId: l.item.productId,
      sku: l.item.sku,
      name: l.item.name,
      qty: l.item.qty,
      unitPrice: l.item.unitPrice,
      discount: l.item.discount,
      taxRateId: l.item.taxRateId,
      taxRateBp: l.item.taxRateBp,
      lineBase: l.lineBase,
      lineDiscount: l.lineDiscount,
      orderDiscountShare,
      taxableBase,
      tax: taxResult.tax,
      lineTotal: taxResult.lineTotal,
      note: l.item.note,
      custom: l.item.custom ?? {},
    };
  });

  // Step 7: Totals & Tax Breakdown
  const subtotal = lines.reduce((acc, l) => acc + l.lineBase, 0);
  const lineDiscounts = lines.reduce((acc, l) => acc + l.lineDiscount, 0);
  const totalTax = lines.reduce((acc, l) => acc + l.tax, 0);
  const totalLines = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const total = totalLines + roundingAdjustment;

  // Group tax breakdown by taxRateId
  const breakdownMap = new Map<UUID, TaxBreakdownEntry>();
  for (const line of lines) {
    const existing = breakdownMap.get(line.taxRateId);
    const baseAmount = pricesIncludeTax ? line.taxableBase - line.tax : line.taxableBase;

    if (existing) {
      existing.base += baseAmount;
      existing.tax += line.tax;
    } else {
      breakdownMap.set(line.taxRateId, {
        taxRateId: line.taxRateId,
        rateBp: line.taxRateBp,
        base: baseAmount,
        tax: line.tax,
      });
    }
  }

  return {
    lines,
    totals: {
      subtotal,
      lineDiscounts,
      orderDiscount: totalOrderDiscount,
      tax: totalTax,
      roundingAdjustment,
      total,
      taxBreakdown: Array.from(breakdownMap.values()),
    },
  };
}
