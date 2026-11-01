import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { completeSale } from './complete-sale';
import type { CartState, Payment, Product, Shift, TaxRate, User } from '@/domain';
import { DEFAULT_CURRENCY, v7 } from '@/domain';

describe('completeSale Service (S5-T2)', () => {
  let db: AppDatabase;

  const mockCashier: User = {
    id: v7(),
    name: 'Roberto Cajero',
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

  const productWithStock: Product = {
    id: v7(),
    sku: 'SKU-STOCK',
    barcodes: ['11111111'],
    name: 'Producto Con Stock',
    priceMinor: 5000, // $50.00
    taxRateId: mockTax.id,
    trackStock: true,
    unit: 'unit',
    allowFractional: false,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const productWithoutStock: Product = {
    id: v7(),
    sku: 'SKU-NO-STOCK',
    barcodes: ['22222222'],
    name: 'Servicio Digital',
    priceMinor: 3000, // $30.00
    taxRateId: mockTax.id,
    trackStock: false,
    unit: 'unit',
    allowFractional: false,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const createMockCart = (qty1 = 2000, qty2 = 1000): CartState => {
    // 2 units of productWithStock ($100.00) + 1 unit of productWithoutStock ($30.00) = $130.00 (13000 minor)
    const base1 = (5000 * qty1) / 1000;
    const base2 = (3000 * qty2) / 1000;
    const total = base1 + base2;

    return {
      items: [],
      pricesIncludeTax: true,
      lines: [
        {
          lineId: v7(),
          productId: productWithStock.id,
          sku: productWithStock.sku,
          name: productWithStock.name,
          qty: qty1,
          unitPrice: productWithStock.priceMinor,
          taxRateId: mockTax.id,
          taxRateBp: mockTax.rateBp,
          lineBase: base1,
          lineDiscount: 0,
          orderDiscountShare: 0,
          taxableBase: base1,
          tax: 0,
          lineTotal: base1,
          custom: {},
        },
        {
          lineId: v7(),
          productId: productWithoutStock.id,
          sku: productWithoutStock.sku,
          name: productWithoutStock.name,
          qty: qty2,
          unitPrice: productWithoutStock.priceMinor,
          taxRateId: mockTax.id,
          taxRateBp: mockTax.rateBp,
          lineBase: base2,
          lineDiscount: 0,
          orderDiscountShare: 0,
          taxableBase: base2,
          tax: 0,
          lineTotal: base2,
          custom: {},
        },
      ],
      totals: {
        subtotal: total,
        lineDiscounts: 0,
        orderDiscount: 0,
        tax: 0,
        roundingAdjustment: 0,
        total,
        taxBreakdown: [],
      },
    };
  };

  beforeEach(async () => {
    db = createAppDatabase(`test_complete_sale_${Date.now()}_${Math.random()}`);
    await db.products.bulkAdd([productWithStock, productWithoutStock]);
    await db.taxRates.add(mockTax);
    await db.users.add(mockCashier);

    // Initial stock for productWithStock: 10 units = 10 000 milli
    await db.stockLevels.add({ productId: productWithStock.id, qty: 10000 });
  });

  it('completes a sale atomically: creates Sale, increments number, updates inventory and outbox', async () => {
    const saleId = v7();
    const cart = createMockCart(2000, 1000); // 2 units of stock product, 1 of no-stock
    const payment: Payment = {
      id: v7(),
      method: 'cash',
      amount: 13000,
      tendered: 15000,
      createdAt: new Date().toISOString(),
    };

    // Pre-populate draft in meta
    await db.meta.put({ key: 'pos_active_cart_draft', value: { lines: [1, 2] } });

    const sale = await completeSale(db, {
      saleId,
      cart,
      payments: [payment],
      change: 2000,
      cashierId: mockCashier.id,
      currency: DEFAULT_CURRENCY,
    });

    // 1. Sale document created with correct number
    expect(sale.id).toBe(saleId);
    expect(sale.number).toBe('L01-000001');
    expect(sale.status).toBe('completed');
    expect(sale.totals.total).toBe(13000);
    expect(sale.change).toBe(2000);

    const savedSale = await db.sales.get(saleId);
    expect(savedSale).toBeDefined();
    expect(savedSale?.number).toBe('L01-000001');

    // 2. Number sequence incremented in meta
    const seqRow = await db.meta.get('saleSeq');
    expect(seqRow?.value).toBe(1);

    // 3. Inventory: Movement created ONLY for productWithStock (-2000)
    const movements = await db.inventoryMovements
      .where('[refType+refId]')
      .equals(['sale', saleId])
      .toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0]!.productId).toBe(productWithStock.id);
    expect(movements[0]!.qty).toBe(-2000);
    expect(movements[0]!.type).toBe('sale');

    // Stock level cache updated: 10000 - 2000 = 8000
    const stock = await db.stockLevels.get(productWithStock.id);
    expect(stock?.qty).toBe(8000);

    // 4. Outbox item created
    const outboxItems = await db.outbox.filter((i) => i.entityId === saleId).toArray();
    expect(outboxItems).toHaveLength(1);
    expect(outboxItems[0]!.entity).toBe('sale');
    expect(outboxItems[0]!.op).toBe('create');
    expect(outboxItems[0]!.status).toBe('pending');

    // 5. Audit entry created
    const auditLogs = await db.auditLog.filter((a) => a.entityId === saleId).toArray();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]!.action).toBe('sale:create');

    // 6. Active cart draft removed from meta
    const draft = await db.meta.get('pos_active_cart_draft');
    expect(draft).toBeUndefined();
  });

  it('guarantees idempotency: double submission returns existing sale without duplicate side effects', async () => {
    const saleId = v7();
    const cart = createMockCart(1000, 1000);
    const payment: Payment = {
      id: v7(),
      method: 'cash',
      amount: 8000,
      tendered: 8000,
      createdAt: new Date().toISOString(),
    };

    // First call
    const sale1 = await completeSale(db, {
      saleId,
      cart,
      payments: [payment],
      change: 0,
      cashierId: mockCashier.id,
      currency: DEFAULT_CURRENCY,
    });

    expect(sale1.number).toBe('L01-000001');

    // Second call with same saleId (e.g. network glitch or double click)
    const sale2 = await completeSale(db, {
      saleId,
      cart,
      payments: [payment],
      change: 0,
      cashierId: mockCashier.id,
      currency: DEFAULT_CURRENCY,
    });

    expect(sale2.id).toBe(saleId);
    expect(sale2.number).toBe('L01-000001');

    // Verify side effects were NOT duplicated
    const salesCount = await db.sales.count();
    expect(salesCount).toBe(1);

    const seqRow = await db.meta.get('saleSeq');
    expect(seqRow?.value).toBe(1); // not incremented to 2

    const movements = await db.inventoryMovements
      .where('[refType+refId]')
      .equals(['sale', saleId])
      .toArray();
    expect(movements).toHaveLength(1); // not 2

    const outboxItems = await db.outbox.filter((i) => i.entityId === saleId).toArray();
    expect(outboxItems).toHaveLength(1); // not 2
  });

  it('validates open shift when settings.requireShift is true', async () => {
    const saleId = v7();
    const cart = createMockCart(1000, 1000);
    const payment: Payment = {
      id: v7(),
      method: 'cash',
      amount: 8000,
      createdAt: new Date().toISOString(),
    };

    // 1. Throws if requireShift is true and no shift is open
    await expect(
      completeSale(db, {
        saleId,
        cart,
        payments: [payment],
        change: 0,
        cashierId: mockCashier.id,
        currency: DEFAULT_CURRENCY,
        settings: {
          id: 'singleton',
          business: { name: 'Test' },
          currency: { code: 'USD', decimals: 2, symbol: '$' },
          pricesIncludeTax: true,
          requireShift: true, // required!
          allowNegativeStock: true,
          maxDiscountBp: 1000,
          paymentMethods: [],
          modules: {},
          receipt: { paperWidthMm: 80, template: null },
          mode: 'local',
        },
      }),
    ).rejects.toThrow(/No hay un turno abierto/i);

    // 2. Opens a shift
    const openShift: Shift = {
      id: v7(),
      deviceId: v7(),
      openedBy: mockCashier.id,
      openedAt: new Date().toISOString(),
      openingFloat: 10000,
      status: 'open',
    };
    await db.shifts.add(openShift);

    // 3. Completes successfully and assigns shiftId
    const sale = await completeSale(db, {
      saleId,
      cart,
      payments: [payment],
      change: 0,
      cashierId: mockCashier.id,
      currency: DEFAULT_CURRENCY,
      settings: {
        id: 'singleton',
        business: { name: 'Test' },
        currency: { code: 'USD', decimals: 2, symbol: '$' },
        pricesIncludeTax: true,
        requireShift: true,
        allowNegativeStock: true,
        maxDiscountBp: 1000,
        paymentMethods: [],
        modules: {},
        receipt: { paperWidthMm: 80, template: null },
        mode: 'local',
      },
    });

    expect(sale.shiftId).toBe(openShift.id);
  });

  // Acceptance Criterion: 100 ventas seguidas < 300 ms cada una (SPEC §13 / BACKLOG S5)
  it('benchmark: completes 100 sequential sales in < 300 ms each with strict sequence', async () => {
    const saleDurations: number[] = [];

    for (let i = 1; i <= 100; i++) {
      const saleId = v7();
      const cart = createMockCart(1000, 0); // 1 unit
      const payment: Payment = {
        id: v7(),
        method: 'cash',
        amount: 5000,
        createdAt: new Date().toISOString(),
      };

      const start = performance.now();
      const sale = await completeSale(db, {
        saleId,
        cart,
        payments: [payment],
        change: 0,
        cashierId: mockCashier.id,
        currency: DEFAULT_CURRENCY,
      });
      const duration = performance.now() - start;
      saleDurations.push(duration);

      const expectedNumber = `L01-${String(i).padStart(6, '0')}`;
      expect(sale.number).toBe(expectedNumber);
    }

    const maxDuration = Math.max(...saleDurations);
    const avgDuration = saleDurations.reduce((acc, d) => acc + d, 0) / saleDurations.length;

    // All sales must complete in < 300 ms (SPEC §13 budget)
    expect(maxDuration).toBeLessThan(300);
    // Typical average is < 50 ms in local DB
    expect(avgDuration).toBeLessThan(100);

    const totalSales = await db.sales.count();
    expect(totalSales).toBe(100);

    const finalSeq = await db.meta.get('saleSeq');
    expect(finalSeq?.value).toBe(100);
  });
});
