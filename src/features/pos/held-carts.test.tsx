import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { createRepositories, type Repositories } from '@/data/repositories';
import { HeldCartsDialog, HoldCartDialog } from './held-carts-dialog';
import { PosView } from './pos-view';
import type { Customer, HeldCart, Product, Settings, TaxRate, User } from '@/domain';
import { v7 } from '@/domain';

describe('Held Carts, Draft Auto-Save & Recovery (S4-T6)', () => {
  let db: AppDatabase;
  let repos: Repositories;

  const mockCustomer: Customer = {
    id: v7(),
    name: 'María Fernández',
    phone: '5511223344',
    taxId: 'FEM800101',
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  const cashierUser: User = {
    id: v7(),
    name: 'Carlos Cajero',
    role: 'cashier',
    active: true,
    pin: { hash: 'h', salt: 's', iterations: 210000 },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const product1: Product = {
    id: v7(),
    sku: 'SKU-001',
    name: 'Café Americano',
    barcodes: ['750100000001'],
    priceMinor: 4000,
    taxRateId: v7(),
    trackStock: false,
    unit: 'unit',
    allowFractional: false,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const product2: Product = {
    id: v7(),
    sku: 'SKU-002',
    name: 'Pan Dulce Concha',
    barcodes: ['750100000002'],
    priceMinor: 2500,
    taxRateId: product1.taxRateId,
    trackStock: false,
    unit: 'unit',
    allowFractional: false,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const mockTax: TaxRate = {
    id: product1.taxRateId,
    name: 'IVA 16%',
    rateBp: 1600,
    active: true,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const mockSettings: Settings = {
    id: 'singleton',
    business: { name: 'Test Store' },
    currency: { code: 'MXN', decimals: 2, symbol: '$' },
    pricesIncludeTax: true,
    requireShift: false,
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
    db = createAppDatabase(`test_held_carts_${Date.now()}_${Math.random()}`);
    repos = createRepositories(db);

    await repos.customers.save(mockCustomer);
    await repos.settings.save(mockSettings);
    await repos.taxRates.save(mockTax);
    await repos.products.save(product1);
    await repos.products.save(product2);
  });

  describe('DexieHeldCartRepository', () => {
    it('saves, retrieves, counts, lists and deletes held carts', async () => {
      const hc1: HeldCart = {
        id: v7(),
        cashierId: cashierUser.id,
        label: 'Mesa 1',
        lines: [{ productId: product1.id, qty: 1000, unitPrice: 4000 }],
        customerId: mockCustomer.id,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      };

      const hc2: HeldCart = {
        id: v7(),
        cashierId: cashierUser.id,
        label: 'Mesa 2',
        lines: [{ productId: product2.id, qty: 2000, unitPrice: 2500 }],
        createdAt: '2026-10-01T12:05:00Z',
        updatedAt: '2026-10-01T12:05:00Z',
      };

      await repos.heldCarts.save(hc1);
      await repos.heldCarts.save(hc2);

      expect(await repos.heldCarts.count()).toBe(2);

      const list = await repos.heldCarts.list();
      expect(list).toHaveLength(2);
      expect(list[0]?.id).toBe(hc2.id); // reverse chronological

      const fetched = await repos.heldCarts.getById(hc1.id);
      expect(fetched?.label).toBe('Mesa 1');

      await repos.heldCarts.delete(hc1.id);
      expect(await repos.heldCarts.count()).toBe(1);
    });
  });

  describe('HeldCartsDialog UI', () => {
    it('displays list of held carts with customer name and total', async () => {
      const hc: HeldCart = {
        id: v7(),
        cashierId: cashierUser.id,
        label: 'Para llevar - Mostrador',
        lines: [
          { productId: product1.id, qty: 1000, unitPrice: 4000 },
          { productId: product2.id, qty: 1000, unitPrice: 2500 },
        ],
        customerId: mockCustomer.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let resumed: HeldCart | null = null;
      let discardedId: string | null = null;

      render(
        <HeldCartsDialog
          isOpen={true}
          onClose={() => {}}
          heldCarts={[hc]}
          currency={mockSettings.currency}
          customersMap={{ [mockCustomer.id]: mockCustomer.name }}
          hasActiveCartItems={false}
          onResumeCart={(c) => {
            resumed = c;
          }}
          onDiscardCart={(id) => {
            discardedId = id;
          }}
        />,
      );

      expect(screen.getByText('Para llevar - Mostrador')).toBeInTheDocument();
      expect(screen.getByText('María Fernández')).toBeInTheDocument();
      expect(screen.getByText(/2 artículos/i)).toBeInTheDocument();

      // Click resume
      const resumeBtn = screen.getByRole('button', { name: /retomar carrito/i });
      fireEvent.click(resumeBtn);
      expect((resumed as HeldCart | null)?.id).toBe(hc.id);

      // Click discard
      const discardBtn = screen.getByRole('button', { name: /descartar/i });
      fireEvent.click(discardBtn);
      expect(discardedId).toBe(hc.id);
    });

    it('requires confirmation before resuming if active cart has items', () => {
      const hc: HeldCart = {
        id: v7(),
        cashierId: cashierUser.id,
        label: 'Mesa 5',
        lines: [{ productId: product1.id, qty: 1000, unitPrice: 4000 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let resumed = false;

      render(
        <HeldCartsDialog
          isOpen={true}
          onClose={() => {}}
          heldCarts={[hc]}
          currency={mockSettings.currency}
          hasActiveCartItems={true}
          onResumeCart={() => {
            resumed = true;
          }}
          onDiscardCart={() => {}}
        />,
      );

      // Warning alert is visible
      expect(screen.getByText(/el carrito actual contiene artículos/i)).toBeInTheDocument();

      // First click asks confirmation
      const resumeBtn = screen.getByRole('button', { name: /retomar carrito/i });
      fireEvent.click(resumeBtn);
      expect(resumed).toBe(false);

      // Second click confirms
      const confirmBtn = screen.getByRole('button', { name: /confirmar y reemplazar/i });
      fireEvent.click(confirmBtn);
      expect(resumed).toBe(true);
    });
  });

  describe('HoldCartDialog UI', () => {
    it('collects optional label and confirms hold', async () => {
      let heldLabel: string | undefined = undefined;

      render(
        <HoldCartDialog
          isOpen={true}
          onClose={() => {}}
          onConfirmHold={(lbl) => {
            heldLabel = lbl;
          }}
        />,
      );

      const input = screen.getByLabelText(/referencia \/ etiqueta/i);
      fireEvent.change(input, { target: { value: 'Mesa 12' } });

      const submitBtn = screen.getByRole('button', { name: /retener venta/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(heldLabel).toBe('Mesa 12');
      });
    });
  });

  describe('PosView Draft Auto-Save & Recovery Integration', () => {
    it('restores draft from meta table upon page load / component mount (SPEC requirement)', async () => {
      // Pre-save a draft in meta
      await repos.meta.set('pos_active_cart_draft', {
        items: [
          {
            lineId: v7(),
            productId: product1.id,
            name: product1.name,
            sku: product1.sku,
            qty: 2000,
            unitPrice: 4000,
            taxRateId: product1.taxRateId,
            taxRateBp: 1600,
            taxRateName: 'IVA 16%',
          },
        ],
        orderDiscount: { type: 'percent', value: 500, reason: 'Promoción' },
        customerId: mockCustomer.id,
        notes: 'Mesa reservada',
      });

      render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

      // Switch to cart tab
      const cartTab = await screen.findByRole('button', { name: /Carrito \(/i });
      fireEvent.click(cartTab);

      // Cart should be restored from draft
      await waitFor(() => {
        expect(screen.getAllByText('Café Americano').length).toBeGreaterThanOrEqual(1);
      });
      await waitFor(() => {
        expect(screen.getByText('María Fernández')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getAllByText(/Descuento General/i).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('holds an active cart, increments counter, clears active cart, and resumes it', async () => {
      render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

      // Wait for products
      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Add Café Americano to cart
      fireEvent.click(screen.getByText('Café Americano'));

      // Cart has 1 item
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retener carrito/i })).toBeInTheDocument();
      });

      // Click "Retener carrito"
      fireEvent.click(screen.getByRole('button', { name: /retener carrito/i }));

      // Fill hold label modal
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /retener carrito/i })).toBeInTheDocument();
      });

      const labelInput = screen.getByLabelText(/referencia \/ etiqueta/i);
      fireEvent.change(labelInput, { target: { value: 'Cliente con prisa' } });
      fireEvent.click(screen.getByRole('button', { name: /retener venta/i }));

      // Active cart is now empty, badge shows 1
      await waitFor(() => {
        expect(screen.getByText(/el carrito está vacío/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /carritos en espera/i })).toHaveTextContent('1');
      });

      // Open held carts modal
      const heldCountBadge = screen.getByRole('button', { name: /carritos en espera/i });
      fireEvent.click(heldCountBadge);

      await waitFor(() => {
        expect(screen.getByText('Cliente con prisa')).toBeInTheDocument();
      });

      // Click "Retomar"
      fireEvent.click(screen.getByRole('button', { name: /retomar carrito/i }));

      // Cart is resumed!
      await waitFor(() => {
        expect(screen.getAllByText('Café Americano').length).toBeGreaterThanOrEqual(1);
      });

      // Held carts count in DB is now 0
      expect(await repos.heldCarts.count()).toBe(0);
    });
  });
});
