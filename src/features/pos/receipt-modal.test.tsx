import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReceiptModal } from './receipt-modal';
import type { Sale, CurrencyConfig } from '@/domain';
import { DEFAULT_CURRENCY, v7 } from '@/domain';

const mockCurrency: CurrencyConfig = DEFAULT_CURRENCY;

const mockSale: Sale = {
  id: v7(),
  number: 'L01-000042',
  deviceId: v7(),
  shiftId: v7(),
  cashierId: v7(),
  customerId: null,
  status: 'completed',
  lines: [
    {
      lineId: v7(),
      productId: v7(),
      sku: 'SKU-COFFEE',
      name: 'Café Americano',
      qty: 2000, // 2 units
      unitPrice: 2500, // $25.00
      taxRateId: v7(),
      taxRateBp: 1600, // 16%
      taxableBase: 4310,
      tax: 690,
      lineBase: 5000,
      lineDiscount: 0,
      orderDiscountShare: 0,
      lineTotal: 5000,
      custom: {},
    },
  ],
  totals: {
    subtotal: 5000,
    lineDiscounts: 0,
    orderDiscount: 0,
    tax: 690,
    roundingAdjustment: 0,
    total: 5000,
    taxBreakdown: [
      {
        taxRateId: v7(),
        rateBp: 1600,
        base: 4310,
        tax: 690,
      },
    ],
  },
  payments: [
    {
      id: v7(),
      method: 'cash',
      amount: 5000,
      tendered: 10000,
      createdAt: '2026-10-26T12:00:00.000Z',
    },
  ],
  change: 5000,
  pricesIncludeTax: true,
  currency: 'USD',
  custom: {},
  createdAt: '2026-10-26T12:00:00.000Z',
  completedAt: '2026-10-26T12:00:00.000Z',
  schemaVersion: 1,
};

const mockBusiness = {
  name: 'Cafetería El Faro',
  taxId: 'RFC123456789',
  address: 'Calle Mayor 10, Ciudad',
  phone: '555-0199',
  footerText: '¡Gracias por su visita!',
};

describe('ReceiptModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    sale: mockSale,
    business: mockBusiness,
    currency: mockCurrency,
    cashierName: 'Juan Pérez',
    customerName: 'Cliente Ocasional',
    paymentMethodLabels: { cash: 'Efectivo' },
    onNewSale: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<ReceiptModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders receipt header, sale folio, business info and lines', () => {
    render(<ReceiptModal {...defaultProps} />);

    // Header modal title and folio
    expect(screen.getByText(/¡Venta completada con éxito!/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Folio: L01-000042/i).length).toBeGreaterThanOrEqual(1);

    // Business details rendered in receipt preview
    expect(screen.getByText('Cafetería El Faro')).toBeInTheDocument();
    expect(screen.getByText(/Calle Mayor 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Café Americano/i)).toBeInTheDocument();

    // Footer text
    expect(screen.getByText('¡Gracias por su visita!')).toBeInTheDocument();
  });

  it('allows toggling between 58mm and 80mm width', () => {
    render(<ReceiptModal {...defaultProps} initialPaperWidthMm={80} />);

    const btn58 = screen.getByRole('button', { name: /58 mm/i });
    const btn80 = screen.getByRole('button', { name: /80 mm/i });

    expect(btn80).toBeInTheDocument();
    expect(btn58).toBeInTheDocument();

    // Click 58 mm
    fireEvent.click(btn58);
    expect(btn58).toHaveClass('bg-background');

    // Click back to 80 mm
    fireEvent.click(btn80);
    expect(btn80).toHaveClass('bg-background');
  });

  it('calls onNewSale when clicking "Nueva Venta"', () => {
    render(<ReceiptModal {...defaultProps} />);

    const newSaleBtn = screen.getByRole('button', { name: /Nueva Venta/i });
    fireEvent.click(newSaleBtn);

    expect(defaultProps.onNewSale).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close icon button is clicked', () => {
    render(<ReceiptModal {...defaultProps} />);

    const closeBtn = screen.getByLabelText(/Cerrar/i);
    fireEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('handles Escape key to trigger onNewSale', () => {
    render(<ReceiptModal {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onNewSale).toHaveBeenCalledTimes(1);
  });

  it('handles Enter key to trigger onNewSale', () => {
    render(<ReceiptModal {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(defaultProps.onNewSale).toHaveBeenCalledTimes(1);
  });

  it('triggers hidden iframe print when clicking "Imprimir Recibo"', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    render(<ReceiptModal {...defaultProps} />);

    const printBtn = screen.getByRole('button', { name: /Imprimir Recibo/i });
    fireEvent.click(printBtn);

    // Verify iframe was appended
    expect(appendChildSpy).toHaveBeenCalled();
    const createdIframe = appendChildSpy.mock.calls.find(
      (args) => (args[0] as HTMLElement).tagName === 'IFRAME',
    )?.[0] as HTMLIFrameElement;

    expect(createdIframe).toBeDefined();
    expect(createdIframe.style.position).toBe('fixed');
    expect(createdIframe.srcdoc).toContain('Cafetería El Faro');
    expect(createdIframe.srcdoc).toContain('L01-000042');

    // Simulate iframe load
    const focusSpy = vi.fn();
    const printSpy = vi.fn();
    Object.defineProperty(createdIframe, 'contentWindow', {
      value: { focus: focusSpy, print: printSpy },
      writable: true,
    });

    act(() => {
      createdIframe.onload?.(new Event('load'));
    });

    expect(focusSpy).toHaveBeenCalled();
    expect(printSpy).toHaveBeenCalled();

    appendChildSpy.mockRestore();
  });

  it('renders reprint watermark and header when isReprint is true', () => {
    render(<ReceiptModal {...defaultProps} isReprint={true} />);

    expect(screen.getByText('Reimpresión de Recibo')).toBeInTheDocument();
    expect(screen.getByText('*** COPIA / REIMPRESIÓN ***')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Cerrar/i }).length).toBeGreaterThanOrEqual(2);
  });
});
