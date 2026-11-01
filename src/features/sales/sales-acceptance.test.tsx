import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { CartState, Settings, User, Product, TaxRate, Customer, Shift } from '@/domain';
import { createEmptyCart, cartReducer, v7, DEFAULT_CURRENCY, buildReceiptDoc } from '@/domain';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { completeSale } from '@/features/pos/complete-sale';
import { CheckoutDialog } from '@/features/pos/checkout-dialog';
import 'fake-indexeddb/auto';

const mockDeviceId = '018f0000-0000-7000-8000-000000000001';
const mockShiftId = '018f0000-0000-7000-8000-000000000002';
const mockCashierId = '018f0000-0000-7000-8000-000000000003';
const mockCustomerId = '018f0000-0000-7000-8000-000000000004';
const mockTaxRateId = '018f0000-0000-7000-8000-000000000005';
const mockProductIdA = '018f0000-0000-7000-8000-000000000010';
const mockProductIdB = '018f0000-0000-7000-8000-000000000020';

const testSettings: Settings = {
  id: 'singleton',
  business: {
    name: 'Supermercado Acceptance Test',
    taxId: 'SAT010101XYZ',
    address: 'Av. Libertador 500',
    phone: '555-1234',
    footerText: '¡Gracias por su compra!',
  },
  currency: {
    code: 'USD',
    decimals: 2,
    symbol: '$',
  },
  pricesIncludeTax: true,
  requireShift: true,
  allowNegativeStock: true,
  maxDiscountBp: 1500, // 15%
  paymentMethods: [
    { id: 'cash', label: 'Efectivo', kind: 'cash', active: true, requireReference: false },
    { id: 'card', label: 'Tarjeta de Crédito', kind: 'card', active: true, requireReference: true },
  ],
  modules: {},
  receipt: {
    paperWidthMm: 80,
    template: null,
  },
  mode: 'local',
};

const testUser: User = {
  id: mockCashierId,
  name: 'Cajero Principal',
  role: 'cashier',
  active: true,
  pin: { hash: 'h', salt: 's', iterations: 1000 },
  version: 1,
  updatedAt: new Date().toISOString(),
};

const testCustomer: Customer = {
  id: mockCustomerId,
  name: 'Cliente Frecuente',
  taxId: 'CLI123456789',
  phone: '555-9988',
  version: 1,
  updatedAt: new Date().toISOString(),
  custom: {},
};

const testTaxRate: TaxRate = {
  id: mockTaxRateId,
  name: 'IVA 16%',
  rateBp: 1600,
  active: true,
  version: 1,
  updatedAt: new Date().toISOString(),
};

const productA: Product = {
  id: mockProductIdA,
  sku: 'PROD-A',
  barcodes: ['11111111'],
  name: 'Galletas de Avena',
  priceMinor: 2500, // $25.00
  taxRateId: mockTaxRateId,
  trackStock: true,
  unit: 'unit',
  allowFractional: false,
  active: true,
  custom: {},
  version: 1,
  updatedAt: new Date().toISOString(),
};

const productB: Product = {
  id: mockProductIdB,
  sku: 'PROD-B',
  barcodes: ['22222222'],
  name: 'Jugo de Naranja 1L',
  priceMinor: 3500, // $35.00
  taxRateId: mockTaxRateId,
  trackStock: true,
  unit: 'unit',
  allowFractional: false,
  active: true,
  custom: {},
  version: 1,
  updatedAt: new Date().toISOString(),
};

describe('Sprint S5 Acceptance Test Suite (docs/BACKLOG.md & docs/SPEC.md)', () => {
  let db: AppDatabase;

  beforeEach(async () => {
    db = createAppDatabase('pos_pwa_acceptance_test_db', { indexedDB });
    await db.open();

    // Clear and seed reference entities
    await db.sales.clear();
    await db.inventoryMovements.clear();
    await db.stockLevels.clear();
    await db.outbox.clear();
    await db.auditLog.clear();
    await db.meta.clear();
    await db.shifts.clear();
    await db.settings.clear();
    await db.products.clear();
    await db.taxRates.clear();
    await db.customers.clear();
    await db.users.clear();

    await db.settings.put(testSettings);
    await db.users.put(testUser);
    await db.customers.put(testCustomer);
    await db.taxRates.put(testTaxRate);
    await db.products.put(productA);
    await db.products.put(productB);

    // Initial stock: 10 units each (10,000 milli)
    await db.stockLevels.put({ productId: productA.id, qty: 10000 });
    await db.stockLevels.put({ productId: productB.id, qty: 10000 });

    // Open shift
    const shift: Shift = {
      id: mockShiftId,
      deviceId: mockDeviceId,
      openedBy: mockCashierId,
      openedAt: new Date().toISOString(),
      openingFloat: 10000,
      status: 'open',
    };
    await db.shifts.put(shift);

    // Metadata
    await db.meta.put({ key: 'deviceId', value: mockDeviceId });
    await db.meta.put({ key: 'deviceSeries', value: 'L01' });
  });

  it('S5-AC1: Venta completa en efectivo con vuelto y deducción de stock atómica', async () => {
    // 1. Build cart: 2 units of Product A ($25.00 ea = $50.00)
    let cart: CartState = createEmptyCart(true);
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: v7(),
        productId: productA.id,
        sku: productA.sku,
        name: productA.name,
        qty: 2000, // 2 units
        unitPrice: productA.priceMinor,
        taxRateId: testTaxRate.id,
        taxRateBp: testTaxRate.rateBp,
      },
    });

    expect(cart.totals.total).toBe(5000); // $50.00

    // 2. Complete sale with $100.00 tendered cash ($50.00 change)
    const saleId = v7();
    const completed = await completeSale(db, {
      saleId,
      cart,
      payments: [
        {
          id: v7(),
          method: 'cash',
          amount: 5000,
          tendered: 10000,
          createdAt: new Date().toISOString(),
        },
      ],
      change: 5000,
      cashierId: mockCashierId,
      currency: DEFAULT_CURRENCY,
      settings: testSettings,
    });

    // Check Sale document
    expect(completed.id).toBe(saleId);
    expect(completed.number).toBe('L01-000001');
    expect(completed.status).toBe('completed');
    expect(completed.totals.total).toBe(5000);
    expect(completed.change).toBe(5000);

    // Check stock deduction in stockLevels
    const updatedStock = await db.stockLevels.get(productA.id);
    expect(updatedStock?.qty).toBe(8000); // 10000 - 2000 = 8000 milli (8 units remaining)

    // Check inventory movement record
    const movements = await db.inventoryMovements
      .where('[refType+refId]')
      .equals(['sale', saleId])
      .toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0]?.qty).toBe(-2000);
    expect(movements[0]?.productId).toBe(productA.id);

    // Check Outbox event
    const outboxItems = await db.outbox.filter((o) => o.entityId === saleId).toArray();
    expect(outboxItems).toHaveLength(1);
    expect(outboxItems[0]?.entity).toBe('sale');
    expect(outboxItems[0]?.op).toBe('create');

    // Check Audit log
    const auditLogs = await db.auditLog.filter((a) => a.entityId === saleId).toArray();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.action).toBe('sale:create');

    // Check ReceiptDoc generation totals match domain exactly
    const receiptDoc = buildReceiptDoc({
      sale: completed,
      business: testSettings.business,
      currency: DEFAULT_CURRENCY,
    });
    expect(
      receiptDoc.blocks.some(
        (b) => b.type === 'row' && b.left === 'TOTAL:' && b.right.includes('50,00'),
      ),
    ).toBe(true);
    expect(
      receiptDoc.blocks.some(
        (b) => b.type === 'row' && b.left === 'Cambio / Vuelto:' && b.right.includes('50,00'),
      ),
    ).toBe(true);
  });

  it('S5-AC2: Venta con pago dividido (efectivo + tarjeta con referencia obligatoria)', async () => {
    // Cart: Product A ($25) + Product B ($35) = $60.00 (6000 cents)
    let cart: CartState = createEmptyCart(true);
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: v7(),
        productId: productA.id,
        sku: productA.sku,
        name: productA.name,
        qty: 1000,
        unitPrice: productA.priceMinor,
        taxRateId: testTaxRate.id,
        taxRateBp: testTaxRate.rateBp,
      },
    });
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: v7(),
        productId: productB.id,
        sku: productB.sku,
        name: productB.name,
        qty: 1000,
        unitPrice: productB.priceMinor,
        taxRateId: testTaxRate.id,
        taxRateBp: testTaxRate.rateBp,
      },
    });

    expect(cart.totals.total).toBe(6000);

    const saleId = v7();
    const payments = [
      {
        id: v7(),
        method: 'cash',
        amount: 2000, // $20.00 cash
        tendered: 2000,
        createdAt: new Date().toISOString(),
      },
      {
        id: v7(),
        method: 'card',
        amount: 4000, // $40.00 card
        reference: 'AUTH-VISA-8821',
        createdAt: new Date().toISOString(),
      },
    ];

    const sale = await completeSale(db, {
      saleId,
      cart,
      payments,
      change: 0,
      cashierId: mockCashierId,
      currency: DEFAULT_CURRENCY,
      settings: testSettings,
    });

    expect(sale.payments).toHaveLength(2);
    expect(sale.payments[0]?.method).toBe('cash');
    expect(sale.payments[0]?.amount).toBe(2000);
    expect(sale.payments[1]?.method).toBe('card');
    expect(sale.payments[1]?.amount).toBe(4000);
    expect(sale.payments[1]?.reference).toBe('AUTH-VISA-8821');
    expect(sale.change).toBe(0);

    // Stock deducted for both products
    const stockA = await db.stockLevels.get(productA.id);
    const stockB = await db.stockLevels.get(productB.id);
    expect(stockA?.qty).toBe(9000);
    expect(stockB?.qty).toBe(9000);
  });

  it('S5-AC3: Venta con descuento de línea y descuento de orden', async () => {
    let cart: CartState = createEmptyCart(true);
    // Product A: 2 units = $50.00
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: v7(),
        productId: productA.id,
        sku: productA.sku,
        name: productA.name,
        qty: 2000,
        unitPrice: productA.priceMinor,
        taxRateId: testTaxRate.id,
        taxRateBp: testTaxRate.rateBp,
      },
    });

    // Apply 10% line discount (1000 bp on $50.00 = $5.00 discount -> $45.00)
    const lineId = cart.lines[0]!.lineId;
    cart = cartReducer(cart, {
      type: 'SET_LINE_DISCOUNT',
      payload: {
        lineId,
        discount: { type: 'percent', value: 1000 },
      },
    });

    // Apply fixed order discount of $5.00 (500 cents) -> final total $40.00
    cart = cartReducer(cart, {
      type: 'SET_ORDER_DISCOUNT',
      payload: { type: 'fixed', value: 500 },
    });

    expect(cart.totals.lineDiscounts).toBe(500);
    expect(cart.totals.orderDiscount).toBe(500);
    expect(cart.totals.total).toBe(4000);

    const saleId = v7();
    const sale = await completeSale(db, {
      saleId,
      cart,
      payments: [
        {
          id: v7(),
          method: 'cash',
          amount: 4000,
          tendered: 5000,
          createdAt: new Date().toISOString(),
        },
      ],
      change: 1000,
      cashierId: mockCashierId,
      currency: DEFAULT_CURRENCY,
      settings: testSettings,
    });

    expect(sale.totals.lineDiscounts).toBe(500);
    expect(sale.totals.orderDiscount).toBe(500);
    expect(sale.totals.total).toBe(4000);
    expect(sale.change).toBe(1000);
  });

  it('S5-AC4: Protección de doble clic e idempotencia en completeSale y CheckoutDialog', async () => {
    let cart: CartState = createEmptyCart(true);
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: v7(),
        productId: productA.id,
        sku: productA.sku,
        name: productA.name,
        qty: 1000,
        unitPrice: productA.priceMinor,
        taxRateId: testTaxRate.id,
        taxRateBp: testTaxRate.rateBp,
      },
    });

    const fixedSaleId = v7();
    const payments = [
      {
        id: v7(),
        method: 'cash',
        amount: 2500,
        tendered: 2500,
        createdAt: new Date().toISOString(),
      },
    ];

    // Call 1
    const sale1 = await completeSale(db, {
      saleId: fixedSaleId,
      cart,
      payments,
      change: 0,
      cashierId: mockCashierId,
      currency: DEFAULT_CURRENCY,
      settings: testSettings,
    });

    // Call 2 with identical saleId (simulating rapid network replay or duplicate click)
    const sale2 = await completeSale(db, {
      saleId: fixedSaleId,
      cart,
      payments,
      change: 0,
      cashierId: mockCashierId,
      currency: DEFAULT_CURRENCY,
      settings: testSettings,
    });

    expect(sale1.id).toBe(fixedSaleId);
    expect(sale2.id).toBe(fixedSaleId);
    expect(sale1.number).toBe(sale2.number);

    // Stock deducted only ONCE (10000 - 1000 = 9000)
    const stock = await db.stockLevels.get(productA.id);
    expect(stock?.qty).toBe(9000);

    // Outbox event created only ONCE
    const outboxEvents = await db.outbox.filter((o) => o.entityId === fixedSaleId).toArray();
    expect(outboxEvents).toHaveLength(1);

    // UI CheckoutDialog double-click prevention
    const onCompleteSaleMock = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    render(
      <CheckoutDialog
        isOpen={true}
        onClose={vi.fn()}
        cart={cart}
        currency={DEFAULT_CURRENCY}
        paymentMethods={testSettings.paymentMethods}
        onCompleteSale={onCompleteSaleMock}
      />,
    );

    // Exact cash shortcut button
    const exactCashBtn = screen.getByRole('button', { name: /Exacto/i });
    fireEvent.click(exactCashBtn);

    const completeBtn = screen.getByRole('button', { name: /Completar Venta/i });

    // Click twice rapidly
    await act(async () => {
      fireEvent.click(completeBtn);
      fireEvent.click(completeBtn);
    });

    await waitFor(() => {
      expect(onCompleteSaleMock).toHaveBeenCalledTimes(1);
    });
  });

  it('S5-AC5: Benchmark de rendimiento de 100 ventas secuenciales < 300 ms cada una', async () => {
    let cart: CartState = createEmptyCart(true);
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: v7(),
        productId: productA.id,
        sku: productA.sku,
        name: productA.name,
        qty: 1000,
        unitPrice: productA.priceMinor,
        taxRateId: testTaxRate.id,
        taxRateBp: testTaxRate.rateBp,
      },
    });

    const count = 100;
    const times: number[] = [];
    const t0 = performance.now();

    for (let i = 0; i < count; i++) {
      const saleId = v7();
      const s0 = performance.now();
      await completeSale(db, {
        saleId,
        cart,
        payments: [
          {
            id: v7(),
            method: 'cash',
            amount: 2500,
            tendered: 2500,
            createdAt: new Date().toISOString(),
          },
        ],
        change: 0,
        cashierId: mockCashierId,
        currency: DEFAULT_CURRENCY,
        settings: testSettings,
      });
      const s1 = performance.now();
      times.push(s1 - s0);
    }

    const tTotal = performance.now() - t0;
    const avgTimePerSale = tTotal / count;
    const maxTimePerSale = Math.max(...times);

    // Backlog criterion: 100 ventas seguidas < 300 ms cada una
    expect(maxTimePerSale).toBeLessThan(300);
    expect(avgTimePerSale).toBeLessThan(50);

    // Verify all 100 sales were created with correlative numbers
    const totalSales = await db.sales.count();
    expect(totalSales).toBe(100);

    const firstSale = await db.sales.where('number').equals('L01-000001').first();
    const lastSale = await db.sales.where('number').equals('L01-000100').first();
    expect(firstSale).toBeDefined();
    expect(lastSale).toBeDefined();
  });
});
