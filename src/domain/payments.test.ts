import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validatePayment,
  calculatePaymentSummary,
  type PaymentMethodConfig,
  type Payment,
} from './payments';
import { generateId } from './ids';

describe('Payment Engine (SPEC §6.3)', () => {
  const cashConfig: PaymentMethodConfig = {
    id: 'cash',
    label: 'Efectivo',
    kind: 'cash',
    active: true,
    requireReference: false,
  };

  const cardConfig: PaymentMethodConfig = {
    id: 'card',
    label: 'Tarjeta',
    kind: 'card',
    active: true,
    requireReference: true,
  };

  const transferConfig: PaymentMethodConfig = {
    id: 'transfer',
    label: 'Transferencia',
    kind: 'transfer',
    active: false, // inactive
    requireReference: true,
  };

  describe('Payment Validation', () => {
    it('accepts valid cash payment', () => {
      const res = validatePayment(5000, 5000, cashConfig);
      expect(res.valid).toBe(true);
    });

    it('rejects payment with zero or negative amount', () => {
      expect(validatePayment(0, 5000, cashConfig).error).toBe('AMOUNT_NON_POSITIVE');
      expect(validatePayment(-100, 5000, cashConfig).error).toBe('AMOUNT_NON_POSITIVE');
    });

    it('rejects inactive payment method', () => {
      const res = validatePayment(2000, 5000, transferConfig, 'REF-123');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('METHOD_INACTIVE');
    });

    it('rejects missing reference when required', () => {
      const resWithoutRef = validatePayment(2000, 5000, cardConfig);
      expect(resWithoutRef.valid).toBe(false);
      expect(resWithoutRef.error).toBe('REFERENCE_REQUIRED');

      const resWithRef = validatePayment(2000, 5000, cardConfig, 'AUTH-9988');
      expect(resWithRef.valid).toBe(true);
    });

    it('rejects non-cash overpayment', () => {
      // Trying to pay 6000 on a 5000 balance with card
      const res = validatePayment(6000, 5000, cardConfig, 'AUTH-001');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('NON_CASH_OVERPAYMENT');
    });

    it('allows cash payment larger than remaining balance (cash can overpay to give change)', () => {
      const res = validatePayment(6000, 5000, cashConfig);
      expect(res.valid).toBe(true);
    });
  });

  describe('Payment Summary & Change Calculation', () => {
    it('calculates change for cash with tendered > amount', () => {
      const payments: Payment[] = [
        {
          id: generateId(),
          method: 'cash',
          amount: 3500,
          tendered: 5000,
          createdAt: new Date().toISOString(),
        },
      ];

      const summary = calculatePaymentSummary(3500, payments);
      expect(summary.totalPaid).toBe(3500);
      expect(summary.totalTendered).toBe(5000);
      expect(summary.remainingDue).toBe(0);
      expect(summary.change).toBe(1500);
      expect(summary.isFullyPaid).toBe(true);
    });

    it('calculates split payment: Card + Cash with change', () => {
      const payments: Payment[] = [
        // Card pays 2000
        {
          id: generateId(),
          method: 'card',
          amount: 2000,
          reference: 'AUTH-1234',
          createdAt: new Date().toISOString(),
        },
        // Cash pays remaining 1500 with a 2000 bill
        {
          id: generateId(),
          method: 'cash',
          amount: 1500,
          tendered: 2000,
          createdAt: new Date().toISOString(),
        },
      ];

      const summary = calculatePaymentSummary(3500, payments);
      expect(summary.totalPaid).toBe(3500);
      expect(summary.totalTendered).toBe(4000); // 2000 card + 2000 cash
      expect(summary.remainingDue).toBe(0);
      expect(summary.change).toBe(500); // 2000 - 1500
      expect(summary.isFullyPaid).toBe(true);
    });

    it('reports remaining due when payment is partial', () => {
      const payments: Payment[] = [
        {
          id: generateId(),
          method: 'card',
          amount: 2000,
          reference: 'AUTH-1',
          createdAt: new Date().toISOString(),
        },
      ];

      const summary = calculatePaymentSummary(5000, payments);
      expect(summary.totalPaid).toBe(2000);
      expect(summary.remainingDue).toBe(3000);
      expect(summary.change).toBe(0);
      expect(summary.isFullyPaid).toBe(false);
    });
  });

  describe('Property-Based Invariants (fast-check)', () => {
    it('Invariant: for cash payments, change is strictly equal to tendered - amount (when tendered >= amount)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1_000_000 }),
          fc.integer({ min: 0, max: 500_000 }),
          (amount, extra) => {
            const tendered = amount + extra;
            const payments: Payment[] = [
              {
                id: generateId(),
                method: 'cash',
                amount,
                tendered,
                createdAt: new Date().toISOString(),
              },
            ];

            const summary = calculatePaymentSummary(amount, payments);
            expect(summary.change).toBe(extra);
            expect(summary.isFullyPaid).toBe(true);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
