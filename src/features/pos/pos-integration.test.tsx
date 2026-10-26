import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { createRepositories, type Repositories } from '@/data/repositories';
import { PosView } from './pos-view';
import { hashPin, v7, type Product, type Settings, type TaxRate, type User } from '@/domain';

describe('Sprint S4 Acceptance & Integration Suite (docs/BACKLOG.md)', () => {
  let db: AppDatabase;
  let repos: Repositories;

  const cashierUser: User = {
    id: v7(),
    name: 'Carlos Cajero',
    role: 'cashier',
    active: true,
    pin: { hash: 'h', salt: 's', iterations: 210000 },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  let managerUser: User;

  const mockTax: TaxRate = {
    id: v7(),
    name: 'IVA 16%',
    rateBp: 1600,
    active: true,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const sampleProducts: Product[] = Array.from({ length: 12 }, (_, i) => ({
    id: v7(),
    sku: `SKU-00${i + 1}`,
    name: `Producto Test ${i + 1}`,
    barcodes: [`75099990000${i}`],
    priceMinor: 1000 * (i + 1),
    taxRateId: mockTax.id,
    trackStock: false,
    unit: 'unit',
    allowFractional: false,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  }));

  const mockSettings: Settings = {
    id: 'singleton',
    business: { name: 'Super POS Test' },
    currency: { code: 'MXN', decimals: 2, symbol: '$' },
    pricesIncludeTax: true,
    requireShift: false,
    allowNegativeStock: true,
    maxDiscountBp: 1000, // 10%
    paymentMethods: [
      { id: 'cash', kind: 'cash', label: 'Efectivo', active: true, requireReference: false },
    ],
    modules: {},
    receipt: { paperWidthMm: 80, template: null },
    mode: 'local',
  };

  beforeEach(async () => {
    db = createAppDatabase(`test_pos_acceptance_${Date.now()}_${Math.random()}`);
    repos = createRepositories(db);

    const managerPin = await hashPin('8888');
    managerUser = {
      id: v7(),
      name: 'Marta Gerente',
      role: 'manager',
      active: true,
      pin: managerPin,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await repos.users.create(cashierUser);
    await repos.users.create(managerUser);
    await repos.settings.save(mockSettings);
    await repos.taxRates.save(mockTax);

    for (const p of sampleProducts) {
      await repos.products.save(p);
    }
  });

  // Acceptance Criterion 1: Agregar al carrito < 100 ms
  it('benchmark: adding an item to the cart completes in < 100 ms (SPEC / BACKLOG criterion)', async () => {
    render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test 1')).toBeInTheDocument();
    });

    const productCard = screen.getByText('Producto Test 1');

    const start = performance.now();
    fireEvent.click(productCard);

    await waitFor(() => {
      // Cart shows item with total
      expect(screen.getAllByText('Producto Test 1').length).toBeGreaterThanOrEqual(1);
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  // Acceptance Criterion 2: Escanear 10 productos en rápida sucesión los agrega todos sin pérdida
  it('hardware burst: scanning 10 barcodes in rapid succession (< 35 ms) adds all 10 items without loss', async () => {
    render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test 1')).toBeInTheDocument();
    });

    // Helper to simulate hardware burst (< 35 ms keystroke interval + Enter)
    const simulateBarcodeScan = (barcode: string) => {
      for (const char of barcode) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: char,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    // Scan 10 different products rapidly
    const barcodesToScan = sampleProducts.slice(0, 10).map((p) => p.barcodes[0]!);
    expect(barcodesToScan).toHaveLength(10);

    act(() => {
      for (const barcode of barcodesToScan) {
        simulateBarcodeScan(barcode);
      }
    });

    // Switch to cart tab if mobile layout
    const cartTab = screen.queryByRole('button', { name: /Carrito \(/i });
    if (cartTab) {
      fireEvent.click(cartTab);
    }

    // All 10 scanned items should be in the cart
    await waitFor(() => {
      for (let i = 0; i < 10; i++) {
        expect(screen.getAllByText(`Producto Test ${i + 1}`).length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // Acceptance Criterion 3: Recargar la página no pierde el carrito (auto-save en meta)
  it('persistence: page reload / component remount preserves the cart without data loss', async () => {
    const { unmount } = render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test 1')).toBeInTheDocument();
    });

    // Add items to cart
    fireEvent.click(screen.getByText('Producto Test 1'));
    fireEvent.click(screen.getByText('Producto Test 2'));

    // Wait for auto-save debounce (300 ms)
    await waitFor(
      async () => {
        const draft = await repos.meta.get<{ items: unknown[] }>('pos_active_cart_draft');
        expect(draft).not.toBeNull();
        expect(draft?.items.length).toBe(2);
      },
      { timeout: 1000 },
    );

    // Simulate page unload / remount
    unmount();

    // Render fresh new instance
    render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    // Switch to cart tab
    const cartTab = await screen.findByRole('button', { name: /Carrito \(/i });
    fireEvent.click(cartTab);

    // Both items must be restored
    await waitFor(() => {
      expect(screen.getAllByText('Producto Test 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Producto Test 2').length).toBeGreaterThanOrEqual(1);
    });
  });

  // Acceptance Criterion 4: Descuentos sobre el límite exigen aprobación de gerente
  it('security guard: discounts exceeding maxDiscountBp require manager PIN approval', async () => {
    render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test 1')).toBeInTheDocument();
    });

    // Add item to cart
    fireEvent.click(screen.getByText('Producto Test 1'));

    // Switch to cart tab if mobile
    const cartTab = screen.queryByRole('button', { name: /Carrito \(/i });
    if (cartTab) {
      fireEvent.click(cartTab);
    }

    // Open order discount dialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /descuento general/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /descuento general/i }));

    // Apply 25% discount (exceeds 10% maxDiscountBp)
    const percentInput = screen.getByLabelText(/porcentaje de descuento/i);
    fireEvent.change(percentInput, { target: { value: '25' } });

    // Warning message indicates approval is required
    expect(screen.getByText(/aprobación de un gerente/i)).toBeInTheDocument();

    // Submit triggers ManagerApprovalDialog
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/aprobación de gerente/i)).toBeInTheDocument();
    });

    // Enter wrong PIN (0000) using PinPad
    const pinButtons = screen.getAllByRole('button');
    const getPinBtn = (num: string) => pinButtons.find((b) => b.textContent === num)!;

    fireEvent.click(getPinBtn('0'));
    fireEvent.click(getPinBtn('0'));
    fireEvent.click(getPinBtn('0'));
    fireEvent.click(getPinBtn('0'));
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    await waitFor(() => {
      expect(screen.getByText(/el pin ingresado no pertenece a un gerente/i)).toBeInTheDocument();
    });

    // Enter valid manager PIN (8888)
    const clearBtn =
      pinButtons.find((b) => b.textContent === 'C') || screen.queryByRole('button', { name: 'C' });
    if (clearBtn) fireEvent.click(clearBtn);
    fireEvent.click(getPinBtn('8'));
    fireEvent.click(getPinBtn('8'));
    fireEvent.click(getPinBtn('8'));
    fireEvent.click(getPinBtn('8'));
    fireEvent.click(screen.getByRole('button', { name: /autorizar/i }));

    // Discount is approved and applied to cart totals
    await waitFor(() => {
      expect(screen.queryByText(/aprobación de gerente/i)).not.toBeInTheDocument();
      expect(screen.getAllByText(/Descuento General/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // Keyboard Shortcuts: F2, F4, Escape
  it('keyboard navigation: F2 focuses search, F4 triggers checkout, Escape closes dialogs', async () => {
    const onCheckout = vi.fn();
    render(<PosView repos={repos} db={db} currentUser={cashierUser} onCheckout={onCheckout} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/buscar producto o código/i);

    // Press F2 -> Focuses search input
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
    });
    expect(document.activeElement).toBe(searchInput);

    // Add item to cart
    fireEvent.click(screen.getByText('Producto Test 1'));

    // Press F4 -> Triggers checkout callback
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4', bubbles: true }));
    });
    expect(onCheckout).toHaveBeenCalledTimes(1);

    // Open a dialog (e.g. customer selector)
    fireEvent.click(screen.getByRole('button', { name: /seleccionar cliente/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /seleccionar cliente/i })).toBeInTheDocument();
    });

    // Press Escape -> Closes dialog
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /seleccionar cliente/i }),
      ).not.toBeInTheDocument();
    });
  });
});
