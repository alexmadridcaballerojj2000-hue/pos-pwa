import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { createRepositories, type Repositories } from '@/data/repositories';
import { useAuthStore } from '@/features/auth/auth-store';
import { PosView } from './pos-view';
import { openShift } from '@/features/shifts/shift-operations';
import { type User, type Product, type Settings, type TaxRate, v7 } from '@/domain';

vi.mock('@/hardware', () => ({
  printerService: {
    print: vi.fn().mockResolvedValue(true),
    setConfig: vi.fn(),
  },
  DEFAULT_PRINTER_CONFIG: {
    driver: 'browser',
    paperWidthMm: 80,
    codePage: 'CP858',
    autoCut: true,
    openDrawer: false,
    drawerPin: 2,
    baudRate: 9600,
  },
}));

describe('POS Shift Guard (SPEC §6.5 & S7-T5)', () => {
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

  const mockTax: TaxRate = {
    id: v7(),
    name: 'IVA 16%',
    rateBp: 1600,
    active: true,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const sampleProduct: Product = {
    id: v7(),
    sku: 'REF-001',
    barcodes: ['123456'],
    name: 'Refresco Cola 600ml',
    categoryId: 'cat_beverages',
    priceMinor: 2500, // $25.00
    costMinor: 1500,
    taxRateId: mockTax.id,
    trackStock: false,
    unit: 'unit',
    allowFractional: false,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const baseSettings: Settings = {
    id: 'singleton',
    business: { name: 'Don Pepe Abarrotes' },
    currency: { code: 'MXN', decimals: 2, symbol: '$' },
    pricesIncludeTax: true,
    requireShift: true,
    allowNegativeStock: true,
    maxDiscountBp: 1000,
    paymentMethods: [
      { id: 'cash', kind: 'cash', label: 'Efectivo', active: true, requireReference: false },
    ],
    modules: {},
    receipt: { paperWidthMm: 80, template: null },
    mode: 'local',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    db = createAppDatabase(`pos_shift_guard_test_${Date.now()}_${Math.random()}`);
    repos = createRepositories(db);

    await repos.users.create(cashierUser);
    await repos.taxRates.save(mockTax);
    await repos.products.save(sampleProduct);

    useAuthStore.setState({
      currentUser: cashierUser,
    });
  });

  it('shows alert banner and intercepts checkout when requireShift is true and no shift is open', async () => {
    const user = userEvent.setup();
    await repos.settings.save({ ...baseSettings, requireShift: true });

    render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    // 1. Verify warning banner is displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Caja cerrada: abre un turno para comenzar a cobrar/i),
      ).toBeInTheDocument();
    });

    // 2. Add product to cart
    await waitFor(() => {
      expect(screen.getByText('Refresco Cola 600ml')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Refresco Cola 600ml'));

    // 3. Switch to cart tab to see Cobrar button
    const cartTab = screen.queryByRole('button', { name: /Carrito \(/i });
    if (cartTab) {
      await user.click(cartTab);
    }

    // 4. Try to click "Cobrar"
    const checkoutBtn = await screen.findByRole('button', { name: /Cobrar/i });
    await user.click(checkoutBtn);

    // 5. Verify checkout dialog is NOT opened; instead OpenShiftDialog is displayed
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Fondo Inicial de Caja/i)).toBeInTheDocument();

    // 6. Open shift via dialog
    const chip200 = screen.getByRole('button', { name: /^200[,.]/i });
    await user.click(chip200);

    const submitOpenBtn = screen.getAllByRole('button', { name: /Abrir Turno/i }).pop()!;
    await user.click(submitOpenBtn);

    // 7. Shift opens, banner disappears, and checkout dialog automatically opens
    await waitFor(() => {
      expect(
        screen.queryByText(/Caja cerrada: abre un turno para comenzar a cobrar/i),
      ).not.toBeInTheDocument();
    });

    // Checkout dialog should now be open
    await waitFor(() => {
      expect(screen.getByText(/Cobro de Venta/i)).toBeInTheDocument();
    });
  });

  it('allows immediate checkout when requireShift is true and shift is already open', async () => {
    const user = userEvent.setup();
    await repos.settings.save({ ...baseSettings, requireShift: true });

    // Open shift beforehand
    await openShift(db, { cashierId: cashierUser.id, openingFloat: 50000 });

    render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    // Warning banner should NOT be present
    await waitFor(() => {
      expect(
        screen.queryByText(/Caja cerrada: abre un turno para comenzar a cobrar/i),
      ).not.toBeInTheDocument();
    });

    // Add product to cart
    await waitFor(() => {
      expect(screen.getByText('Refresco Cola 600ml')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Refresco Cola 600ml'));

    // Switch to cart tab
    const cartTab = screen.queryByRole('button', { name: /Carrito \(/i });
    if (cartTab) {
      await user.click(cartTab);
    }

    // Click Cobrar
    const checkoutBtn = await screen.findByRole('button', { name: /Cobrar/i });
    await user.click(checkoutBtn);

    // Direct checkout dialog
    await waitFor(() => {
      expect(screen.getByText(/Cobro de Venta/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Fondo Inicial de Caja/i)).not.toBeInTheDocument();
    });
  });

  it('does not require shift when requireShift is false', async () => {
    const user = userEvent.setup();
    await repos.settings.save({ ...baseSettings, requireShift: false });

    render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

    await waitFor(() => {
      expect(
        screen.queryByText(/Caja cerrada: abre un turno para comenzar a cobrar/i),
      ).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Refresco Cola 600ml')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Refresco Cola 600ml'));

    // Switch to cart tab
    const cartTab = screen.queryByRole('button', { name: /Carrito \(/i });
    if (cartTab) {
      await user.click(cartTab);
    }

    const checkoutBtn = await screen.findByRole('button', { name: /Cobrar/i });
    await user.click(checkoutBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cobro de Venta/i)).toBeInTheDocument();
    });
  });
});
