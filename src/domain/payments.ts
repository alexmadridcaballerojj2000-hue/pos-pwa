import type { Minor, UUID, ISODate } from './index';

export interface PaymentMethodConfig {
  id: string;
  label: string;
  kind: 'cash' | 'card' | 'transfer' | 'other';
  active: boolean;
  requireReference: boolean;
}

export interface Payment {
  id: UUID;
  method: string;
  amount: Minor;
  tendered?: Minor;
  reference?: string;
  createdAt: ISODate;
}

export type PaymentValidationError =
  'AMOUNT_NON_POSITIVE' | 'METHOD_INACTIVE' | 'REFERENCE_REQUIRED' | 'NON_CASH_OVERPAYMENT';

export interface PaymentValidationResult {
  valid: boolean;
  error?: PaymentValidationError;
}

export interface PaymentSummary {
  totalPaid: Minor;
  totalTendered: Minor;
  remainingDue: Minor;
  change: Minor;
  isFullyPaid: boolean;
}

/**
 * Validates an incoming payment attempt against business rules (SPEC §6.3):
 * 1. amount > 0
 * 2. Payment method must be active
 * 3. Reference is strictly required if methodConfig.requireReference === true
 * 4. Non-cash payments cannot exceed the remaining balance due
 *
 * @param amount - Minor amount to be applied to the sale
 * @param remainingDue - Current unpaid balance in Minor units
 * @param methodConfig - Method configuration from Settings
 * @param reference - Optional payment reference (e.g. authorization code)
 */
export function validatePayment(
  amount: Minor,
  remainingDue: Minor,
  methodConfig: PaymentMethodConfig,
  reference?: string,
): PaymentValidationResult {
  if (amount <= 0) {
    return { valid: false, error: 'AMOUNT_NON_POSITIVE' };
  }

  if (!methodConfig.active) {
    return { valid: false, error: 'METHOD_INACTIVE' };
  }

  if (methodConfig.requireReference && (!reference || reference.trim().length === 0)) {
    return { valid: false, error: 'REFERENCE_REQUIRED' };
  }

  if (methodConfig.kind !== 'cash' && amount > remainingDue) {
    return { valid: false, error: 'NON_CASH_OVERPAYMENT' };
  }

  return { valid: true };
}

/**
 * Calculates payment totals, remaining balance, and change according to SPEC §6.3.
 *
 * Rules:
 * - Change is generated exclusively when cash tendered exceeds the applied amount.
 * - Non-cash payments cannot create change.
 *
 * @param saleTotal - Final sale total in Minor units
 * @param payments - List of completed payments for this sale
 */
export function calculatePaymentSummary(saleTotal: Minor, payments: Payment[]): PaymentSummary {
  let totalPaid = 0;
  let totalTendered = 0;
  let totalCashChange = 0;

  for (const payment of payments) {
    totalPaid += payment.amount;
    const tendered = payment.tendered ?? payment.amount;
    totalTendered += tendered;

    if (payment.tendered && payment.tendered > payment.amount) {
      totalCashChange += payment.tendered - payment.amount;
    }
  }

  const remainingDue = Math.max(0, saleTotal - totalPaid);
  const isFullyPaid = totalPaid >= saleTotal;

  // Change is totalCashChange plus any excess cash if payment.amount alone exceeds saleTotal
  const excess = Math.max(0, totalPaid - saleTotal);
  const change = totalCashChange + excess;

  return {
    totalPaid,
    totalTendered,
    remainingDue,
    change,
    isFullyPaid,
  };
}
