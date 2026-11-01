import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CheckoutDialog } from './checkout-dialog';
import type { CartState, PaymentMethodConfig } from '@/domain';
import { DEFAULT_CURRENCY } from '@/domain';

describe('CheckoutDialog Component (S5-T1)', () => {
  const samplePaymentMethods: PaymentMethodConfig[] = [
    { id: 'cash', kind: 'cash', label: 'Efectivo', active: true, requireReference: false },
    { id: 'card', kind: 'card', label: 'Tarjeta', active: true, requireReference: true },
    {
      id: 'transfer',
      kind: 'transfer',
      label: 'Transferencia',
      active: true,
      requireReference: true,
    },
    { id: 'inactive', kind: 'other', label: 'Inactivo', active: false, requireReference: false },
  ];

  const mockCart: CartState = {
    items: [],
    pricesIncludeTax: true,
    lines: [
      {
        lineId: 'line-1',
        productId: 'prod-1',
        sku: 'SKU-1',
        name: 'Producto 1',
        qty: 1000,
        unitPrice: 14500, // $145.00
        taxRateId: 'tax-1',
        taxRateBp: 1600,
        lineBase: 14500,
        lineDiscount: 0,
        orderDiscountShare: 0,
        taxableBase: 12500,
        tax: 2000,
        lineTotal: 14500,
        custom: {},
      },
    ],
    totals: {
      subtotal: 14500,
      lineDiscounts: 0,
      orderDiscount: 0,
      tax: 2000,
      roundingAdjustment: 0,
      total: 14500, // $145.00
      taxBreakdown: [],
    },
  };

  it('renders total to pay, customer name, and default cash payment method', () => {
    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        customerName="Juan Pérez"
        onCompleteSale={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /Cobro de Venta/i })).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getAllByText(/145,00/).length).toBeGreaterThanOrEqual(1);
    // Inactive methods are not shown
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
    // Cash is active and selected
    expect(screen.getByRole('button', { name: /Efectivo/i })).toBeInTheDocument();
  });

  it('populates quick cash buttons for cash method and allows tender entry', () => {
    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        onCompleteSale={vi.fn()}
      />,
    );

    // Exact button
    const exactBtn = screen.getByRole('button', { name: /Exacto/i });
    expect(exactBtn).toBeInTheDocument();

    // Quick cash options for 14500 ($145.00) include $200.00
    const btn200 = screen.getByRole('button', { name: /200,00/ });
    expect(btn200).toBeInTheDocument();

    // Click $200.00
    fireEvent.click(btn200);

    const amountInput = screen.getByLabelText(/Monto Recibido/i) as HTMLInputElement;
    expect(amountInput.value).toBe('200.00');
  });

  it('allows entering amount via touch numpad', () => {
    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        onCompleteSale={vi.fn()}
      />,
    );

    const amountInput = screen.getByLabelText(/Monto Recibido/i) as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '' } });

    // Press numpad 5, 0, 0
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(amountInput.value).toBe('500');

    // Click DEL / Borrar to remove last digit
    const delBtn = screen.getByRole('button', { name: 'Borrar' });
    fireEvent.click(delBtn);
    expect(amountInput.value).toBe('50');
  });

  it('calculates change when cash tendered exceeds remaining balance and completes sale', async () => {
    const onComplete = vi.fn();

    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        onCompleteSale={onComplete}
      />,
    );

    // Select $200.00 quick cash for a $145.00 sale
    const btn200 = screen.getByRole('button', { name: /200,00/ });
    fireEvent.click(btn200);

    const completeBtn = screen.getByRole('button', { name: /Completar Venta/i });
    expect(completeBtn).not.toBeDisabled();

    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
      const params = onComplete.mock.calls[0]![0]!;
      expect(params.saleId).toBeDefined();
      expect(params.change).toBe(5500); // $55.00 change
      expect(params.payments).toHaveLength(1);
      expect(params.payments[0]!.amount).toBe(14500);
      expect(params.payments[0]!.tendered).toBe(20000);
    });
  });

  it('supports split payments across multiple payment methods', async () => {
    const onComplete = vi.fn();

    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart} // Total: 14500 ($145.00)
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        onCompleteSale={onComplete}
      />,
    );

    // 1. First payment: $45.00 in cash
    const amountInput = screen.getByLabelText(/Monto Recibido/i);
    fireEvent.change(amountInput, { target: { value: '45.00' } });

    // Click "Agregar Pago"
    const addPaymentBtn = screen.getByRole('button', { name: /Agregar Pago/i });
    fireEvent.click(addPaymentBtn);

    // Now payments list has 1 item and remaining is $100.00
    await waitFor(() => {
      expect(screen.getByText(/Pagos Registrados/i)).toBeInTheDocument();
      expect(screen.getAllByText(/100,00/).length).toBeGreaterThanOrEqual(1);
    });

    // 2. Second payment: switch to Card, enter reference
    fireEvent.click(screen.getByRole('button', { name: /Tarjeta/i }));

    // Reference is required for card
    const refInput = screen.getByLabelText(/Referencia/i);
    fireEvent.change(refInput, { target: { value: 'AUTH-1234' } });

    // Click "Completar Venta"
    const completeBtn = screen.getByRole('button', { name: /Completar Venta/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
      const params = onComplete.mock.calls[0]![0]!;
      expect(params.payments).toHaveLength(2);
      expect(params.payments[0]!.method).toBe('cash');
      expect(params.payments[0]!.amount).toBe(4500);
      expect(params.payments[1]!.method).toBe('card');
      expect(params.payments[1]!.amount).toBe(10000);
      expect(params.payments[1]!.reference).toBe('AUTH-1234');
      expect(params.change).toBe(0);
    });
  });

  it('rejects card payment without required reference', async () => {
    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        onCompleteSale={vi.fn()}
      />,
    );

    // Switch to Card
    fireEvent.click(screen.getByRole('button', { name: /Tarjeta/i }));

    // Reference field is empty
    const completeBtn = screen.getByRole('button', { name: /Completar Venta/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByText(/La referencia es obligatoria/i)).toBeInTheDocument();
    });
  });

  it('rejects non-cash overpayment according to SPEC §6.3', async () => {
    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        onCompleteSale={vi.fn()}
      />,
    );

    // Switch to Card
    fireEvent.click(screen.getByRole('button', { name: /Tarjeta/i }));

    const amountInput = screen.getByLabelText(/Monto Recibido/i);
    // Overpayment with card ($200.00 > $145.00)
    fireEvent.change(amountInput, { target: { value: '200.00' } });

    const refInput = screen.getByLabelText(/Referencia/i);
    fireEvent.change(refInput, { target: { value: 'AUTH-123' } });

    const completeBtn = screen.getByRole('button', { name: /Completar Venta/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Los pagos sin efectivo no pueden exceder el saldo restante/i),
      ).toBeInTheDocument();
    });
  });

  it('prevents double-click submissions (idempotency)', async () => {
    let resolveSale: () => void = () => {};
    const salePromise = new Promise<void>((resolve) => {
      resolveSale = resolve;
    });

    const onComplete = vi.fn().mockReturnValue(salePromise);

    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={mockCart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={samplePaymentMethods}
        onCompleteSale={onComplete}
      />,
    );

    const completeBtn = screen.getByRole('button', { name: /Completar Venta/i });
    fireEvent.click(completeBtn);

    // Second click immediately
    fireEvent.click(completeBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Procesando venta/i)).toBeInTheDocument();

    resolveSale();
  });
});
