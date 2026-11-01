import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateExpectedCash,
  calculateShiftDifference,
  summarizeShiftSales,
  summarizeCashMovements,
  summarizeShift,
} from './cash-calculation';
import type { Sale, Shift, CashMovement } from '../types';

describe('Cash Calculation & Shift Reconciliation (SPEC §6.5)', () => {
  describe('calculateExpectedCash', () => {
    it('calculates expected cash with only opening float', () => {
      const expected = calculateExpectedCash({
        openingFloat: 50000, // $500.00
        cashSales: 0,
        cashIn: 0,
        cashOut: 0,
      });
      expect(expected).toBe(50000);
    });

    it('calculates expected cash with cash sales, cash in, cash out, and cash returns', () => {
      // Opening: $1,000.00 (100000)
      // Cash Sales: $2,500.00 (250000)
      // Cash In: $300.00 (30000)
      // Cash Out: $400.00 (40000)
      // Cash Returns: $150.00 (15000)
      // Expected = 100000 + 250000 + 30000 - 40000 - 15000 = 325000 ($3,250.00)
      const expected = calculateExpectedCash({
        openingFloat: 100000,
        cashSales: 250000,
        cashIn: 30000,
        cashOut: 40000,
        cashReturns: 15000,
      });
      expect(expected).toBe(325000);
    });

    it('calculates difference accurately', () => {
      // Exact match
      expect(calculateShiftDifference(325000, 325000)).toBe(0);
      // Overage of $50.00
      expect(calculateShiftDifference(330000, 325000)).toBe(5000);
      // Shortage of $20.00
      expect(calculateShiftDifference(323000, 325000)).toBe(-2000);
    });
  });

  describe('Property-based testing (fast-check)', () => {
    it('invariant: difference + expectedCash === countedCash for all integer amounts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }), // countedCash (up to $100,000.00)
          fc.integer({ min: 0, max: 10_000_000 }), // expectedCash
          (counted, expected) => {
            const diff = calculateShiftDifference(counted, expected);
            expect(diff + expected).toBe(counted);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('invariant: expectedCash scales monotonically with cash sales and cash in', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.integer({ min: 0, max: 1_000_000 }),
          (openingFloat, cashSales, cashIn, cashOut, cashReturns) => {
            const base = calculateExpectedCash({
              openingFloat,
              cashSales,
              cashIn,
              cashOut,
              cashReturns,
            });

            const withMoreSales = calculateExpectedCash({
              openingFloat,
              cashSales: cashSales + 5000,
              cashIn,
              cashOut,
              cashReturns,
            });
            expect(withMoreSales).toBe(base + 5000);

            const withMoreOut = calculateExpectedCash({
              openingFloat,
              cashSales,
              cashIn,
              cashOut: cashOut + 2000,
              cashReturns,
            });
            expect(withMoreOut).toBe(base - 2000);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('invariant: summarizeCashMovements always satisfies netMovement === inTotal - outTotal', () => {
      const movementArbitrary = fc.array(
        fc.record({
          id: fc.uuid(),
          shiftId: fc.uuid(),
          type: fc.constantFrom<'in' | 'out'>('in', 'out'),
          amount: fc.integer({ min: 0, max: 500_000 }),
          reason: fc.string({ minLength: 1, maxLength: 50 }),
          createdBy: fc.uuid(),
          createdAt: fc.constant('2026-11-01T12:00:00.000Z'),
        }),
        { maxLength: 30 },
      );

      fc.assert(
        fc.property(movementArbitrary, (movements) => {
          const summary = summarizeCashMovements(movements as CashMovement[]);
          expect(summary.netMovement).toBe(summary.inTotal - summary.outTotal);
          expect(summary.inCount + summary.outCount).toBe(movements.length);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('summarizeShift Integration', () => {
    it('accurately aggregates sales with mixed payment methods and cash movements', () => {
      const mockShift: Shift = {
        id: 'shift-1',
        deviceId: 'dev-1',
        openedBy: 'user-1',
        openedAt: '2026-11-01T08:00:00.000Z',
        openingFloat: 50000, // $500.00
        status: 'open',
      };

      const mockSales: Partial<Sale>[] = [
        // Sale 1: $100.00 paid 100% in cash
        {
          id: 'sale-1',
          totals: {
            subtotal: 10000,
            lineDiscounts: 0,
            orderDiscount: 0,
            tax: 1600,
            roundingAdjustment: 0,
            total: 10000,
            taxBreakdown: [],
          },
          payments: [
            {
              id: 'p-1',
              method: 'cash',
              amount: 10000,
              tendered: 10000,
              createdAt: '2026-11-01T09:00:00.000Z',
            },
          ],
        },
        // Sale 2: $200.00 split payment ($50.00 cash + $150.00 card)
        {
          id: 'sale-2',
          totals: {
            subtotal: 20000,
            lineDiscounts: 0,
            orderDiscount: 0,
            tax: 3200,
            roundingAdjustment: 0,
            total: 20000,
            taxBreakdown: [],
          },
          payments: [
            {
              id: 'p-2',
              method: 'cash',
              amount: 5000,
              tendered: 5000,
              createdAt: '2026-11-01T10:00:00.000Z',
            },
            {
              id: 'p-3',
              method: 'card',
              amount: 15000,
              reference: 'AUTH-123',
              createdAt: '2026-11-01T10:00:00.000Z',
            },
          ],
        },
        // Sale 3: $80.00 paid 100% card
        {
          id: 'sale-3',
          totals: {
            subtotal: 8000,
            lineDiscounts: 0,
            orderDiscount: 0,
            tax: 1280,
            roundingAdjustment: 0,
            total: 8000,
            taxBreakdown: [],
          },
          payments: [
            {
              id: 'p-4',
              method: 'card',
              amount: 8000,
              reference: 'AUTH-456',
              createdAt: '2026-11-01T11:00:00.000Z',
            },
          ],
        },
      ];

      const mockMovements: CashMovement[] = [
        {
          id: 'mov-1',
          shiftId: 'shift-1',
          type: 'in',
          amount: 20000, // $200.00 entry
          reason: 'Aporte de cambio adicional',
          createdBy: 'user-1',
          createdAt: '2026-11-01T08:30:00.000Z',
        },
        {
          id: 'mov-2',
          shiftId: 'shift-1',
          type: 'out',
          amount: 15000, // $150.00 exit
          reason: 'Pago de hielo y garrafón',
          createdBy: 'user-1',
          createdAt: '2026-11-01T10:30:00.000Z',
        },
      ];

      const summary = summarizeShift(mockShift, mockSales as Sale[], mockMovements);

      // Verify sales summary
      expect(summary.sales.totalSalesCount).toBe(3);
      expect(summary.sales.netTotal).toBe(38000); // 100 + 200 + 80 = 380.00
      expect(summary.sales.cashSalesTotal).toBe(15000); // 100 + 50 = 150.00
      expect(summary.sales.payments['cash']?.total).toBe(15000);
      expect(summary.sales.payments['card']?.total).toBe(23000); // 150 + 80 = 230.00

      // Verify movements summary
      expect(summary.movements.inTotal).toBe(20000);
      expect(summary.movements.outTotal).toBe(15000);
      expect(summary.movements.netMovement).toBe(5000);

      // Verify expected cash:
      // openingFloat (50000) + cashSales (15000) + cashIn (20000) - cashOut (15000) = 70000 ($700.00)
      expect(summary.expectedCash).toBe(70000);
    });
  });

  describe('summarizeShiftSales', () => {
    it('accurately aggregates gross sales, discounts, taxes and payment methods', () => {
      const sales: Sale[] = [
        {
          id: '018f0000-0000-7000-8000-000000000001',
          number: 'L01-000001',
          deviceId: '018f0000-0000-7000-8000-000000000000',
          shiftId: '018f0000-0000-7000-8000-000000000099',
          cashierId: '018f0000-0000-7000-8000-000000000002',
          customerId: null,
          status: 'completed',
          lines: [],
          totals: {
            subtotal: 10000,
            lineDiscounts: 500,
            orderDiscount: 500,
            totalDiscount: 1000,
            tax: 1500,
            total: 10500,
            taxBreakdown: [],
          },
          payments: [{ method: 'cash', amount: 10500 }],
          change: 0,
          pricesIncludeTax: true,
          completedAt: '2026-11-01T10:00:00.000Z',
          receiptPrinted: false,
        },
      ];

      const res = summarizeShiftSales(sales);
      expect(res.totalSalesCount).toBe(1);
      expect(res.grossSales).toBe(10000);
      expect(res.totalDiscounts).toBe(1000);
      expect(res.tax).toBe(1500);
      expect(res.netTotal).toBe(10500);
      expect(res.cashSalesTotal).toBe(10500);
      expect(res.payments['cash']?.count).toBe(1);
    });
  });
});
