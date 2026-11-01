import type { Minor } from '../money';
import type { Sale, Shift, CashMovement } from '../types';

export interface CalculateExpectedCashParams {
  openingFloat: Minor;
  cashSales: Minor;
  cashIn: Minor;
  cashOut: Minor;
  cashReturns?: Minor;
}

/**
 * Calculates the expected cash in drawer at shift close according to SPEC §6.5:
 * expectedCash = openingFloat + cashSales + cashIn - cashOut - cashReturns
 */
export function calculateExpectedCash(params: CalculateExpectedCashParams): Minor {
  const { openingFloat, cashSales, cashIn, cashOut, cashReturns = 0 } = params;
  return openingFloat + cashSales + cashIn - cashOut - cashReturns;
}

/**
 * Calculates the difference between counted cash and expected cash:
 * difference = countedCash - expectedCash
 * > 0: cash overage (sobrante)
 * < 0: cash shortage (faltante)
 * = 0: balanced (cuadrado)
 */
export function calculateShiftDifference(countedCash: Minor, expectedCash: Minor): Minor {
  return countedCash - expectedCash;
}

export interface ShiftPaymentSummary {
  method: string;
  count: number;
  total: Minor;
}

export interface ShiftSalesSummary {
  totalSalesCount: number;
  grossSales: Minor;
  lineDiscounts: Minor;
  orderDiscounts: Minor;
  totalDiscounts: Minor;
  tax: Minor;
  netTotal: Minor;
  payments: Record<string, ShiftPaymentSummary>;
  cashSalesTotal: Minor;
}

export interface ShiftCashMovementsSummary {
  inCount: number;
  inTotal: Minor;
  outCount: number;
  outTotal: Minor;
  netMovement: Minor;
}

export interface ShiftSummary {
  shift: Shift;
  sales: ShiftSalesSummary;
  movements: ShiftCashMovementsSummary;
  cashReturns: Minor;
  expectedCash: Minor;
  difference?: Minor;
}

/**
 * Aggregates all sales for a shift into a financial breakdown.
 */
export function summarizeShiftSales(sales: Sale[]): ShiftSalesSummary {
  let grossSales = 0;
  let lineDiscounts = 0;
  let orderDiscounts = 0;
  let tax = 0;
  let netTotal = 0;
  let cashSalesTotal = 0;
  const payments: Record<string, ShiftPaymentSummary> = {};

  for (const sale of sales) {
    grossSales += sale.totals.subtotal;
    lineDiscounts += sale.totals.lineDiscounts;
    orderDiscounts += sale.totals.orderDiscount;
    tax += sale.totals.tax;
    netTotal += sale.totals.total;

    for (const payment of sale.payments) {
      const method = payment.method;
      if (!payments[method]) {
        payments[method] = { method, count: 0, total: 0 };
      }
      payments[method].count += 1;
      payments[method].total += payment.amount;

      if (method === 'cash') {
        cashSalesTotal += payment.amount;
      }
    }
  }

  return {
    totalSalesCount: sales.length,
    grossSales,
    lineDiscounts,
    orderDiscounts,
    totalDiscounts: lineDiscounts + orderDiscounts,
    tax,
    netTotal,
    payments,
    cashSalesTotal,
  };
}

/**
 * Aggregates all manual cash in/out movements for a shift.
 */
export function summarizeCashMovements(movements: CashMovement[]): ShiftCashMovementsSummary {
  let inCount = 0;
  let inTotal = 0;
  let outCount = 0;
  let outTotal = 0;

  for (const mov of movements) {
    if (mov.type === 'in') {
      inCount += 1;
      inTotal += mov.amount;
    } else if (mov.type === 'out') {
      outCount += 1;
      outTotal += mov.amount;
    }
  }

  return {
    inCount,
    inTotal,
    outCount,
    outTotal,
    netMovement: inTotal - outTotal,
  };
}

/**
 * Produces a complete shift financial summary according to SPEC §6.5.
 */
export function summarizeShift(
  shift: Shift,
  sales: Sale[],
  movements: CashMovement[],
  cashReturns = 0,
): ShiftSummary {
  const salesSummary = summarizeShiftSales(sales);
  const movementsSummary = summarizeCashMovements(movements);

  const expectedCash = calculateExpectedCash({
    openingFloat: shift.openingFloat,
    cashSales: salesSummary.cashSalesTotal,
    cashIn: movementsSummary.inTotal,
    cashOut: movementsSummary.outTotal,
    cashReturns,
  });

  const difference =
    shift.countedCash !== undefined
      ? calculateShiftDifference(shift.countedCash, expectedCash)
      : undefined;

  return {
    shift,
    sales: salesSummary,
    movements: movementsSummary,
    cashReturns,
    expectedCash,
    difference,
  };
}
