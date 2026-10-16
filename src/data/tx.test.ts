import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from './db';
import { withTx, type TxContext } from './tx';
import { FakeClock, type Sale, type SaleLine } from '@/domain';

describe('withTx (Atomic Business Transactions)', () => {
  let db: AppDatabase;
  const fakeClock = new FakeClock(new Date('2026-03-01T12:00:00.000Z'));
  const testContext: TxContext = {
    userId: '018f0000-0000-7000-8000-000000000001',
    clock: fakeClock,
    description: 'Sale transaction',
  };

  beforeEach(() => {
    db = createAppDatabase(`test_tx_${Date.now()}_${Math.random()}`);
  });

  const createSampleSale = (saleId: string, saleNumber: string): Sale => {
    const line: SaleLine = {
      lineId: '018f0000-0000-7000-8000-000000000010',
      productId: '018f0000-0000-7000-8000-000000000020',
      sku: 'PROD-1',
      name: 'Product 1',
      qty: 2000, // 2 units (in milli)
      unitPrice: 1500,
      taxRateId: '018f0000-0000-7000-8000-000000000000',
      taxRateBp: 0,
      lineBase: 3000,
      lineDiscount: 0,
      orderDiscountShare: 0,
      taxableBase: 3000,
      tax: 0,
      lineTotal: 3000,
      custom: {},
    };

    return {
      id: saleId,
      number: saleNumber,
      deviceId: '018f0000-0000-7000-8000-000000000000',
      shiftId: '018f0000-0000-7000-8000-000000000005',
      cashierId: testContext.userId,
      status: 'completed',
      lines: [line],
      totals: {
        subtotal: 3000,
        lineDiscounts: 0,
        orderDiscount: 0,
        tax: 0,
        roundingAdjustment: 0,
        total: 3000,
        taxBreakdown: [],
      },
      payments: [
        {
          id: '018f0000-0000-7000-8000-000000000030',
          method: 'cash',
          amount: 3000,
          createdAt: fakeClock.now().toISOString(),
        },
      ],
      change: 0,
      pricesIncludeTax: false,
      currency: 'USD',
      custom: {},
      createdAt: fakeClock.now().toISOString(),
      completedAt: fakeClock.now().toISOString(),
      schemaVersion: 1,
    };
  };

  it('records sale, derived inventory movements, stock levels, outbox event and audit log in a single transaction', async () => {
    // Seed initial stock of 10 units (10000 milli)
    const productId = '018f0000-0000-7000-8000-000000000020';
    await db.stockLevels.put({ productId, qty: 10000 });

    const sale = createSampleSale('018f0000-0000-7000-8000-000000000099', 'L01-000001');

    await withTx(db, testContext, async (scope) => {
      await scope.recordSale({ sale });
    });

    // 1. Sale persisted
    const savedSale = await db.sales.get(sale.id);
    expect(savedSale).toBeDefined();
    expect(savedSale?.number).toBe('L01-000001');

    // 2. Inventory movement created (-2000 milli)
    const movements = await db.inventoryMovements.where('productId').equals(productId).toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0]?.qty).toBe(-2000);
    expect(movements[0]?.type).toBe('sale');
    expect(movements[0]?.refId).toBe(sale.id);

    // 3. StockLevel updated from 10000 to 8000
    const stock = await db.stockLevels.get(productId);
    expect(stock?.qty).toBe(8000);

    // 4. Outbox item created
    const outboxItems = await db.outbox.toArray();
    expect(outboxItems).toHaveLength(1);
    expect(outboxItems[0]?.entity).toBe('sale');
    expect(outboxItems[0]?.entityId).toBe(sale.id);
    expect(outboxItems[0]?.status).toBe('pending');

    // 5. Audit entry created
    const auditEntries = await db.auditLog.toArray();
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]?.action).toBe('sale:create');
    expect(auditEntries[0]?.entityId).toBe(sale.id);
  });

  it('GUARANTEES ATOMICITY: rolls back completely if an error is thrown during transaction', async () => {
    const productId = '018f0000-0000-7000-8000-000000000020';
    await db.stockLevels.put({ productId, qty: 10000 });

    const sale = createSampleSale('018f0000-0000-7000-8000-000000000099', 'L01-000001');

    const executionPromise = withTx(db, testContext, async (scope) => {
      await scope.recordSale({ sale });
      // Simulate fatal error halfway through
      throw new Error('FATAL_FAILURE_MID_TRANSACTION');
    });

    await expect(executionPromise).rejects.toThrow('FATAL_FAILURE_MID_TRANSACTION');

    // VERIFY ZERO PARTIAL WRITES PERSISTED
    const salesCount = await db.sales.count();
    const movementsCount = await db.inventoryMovements.count();
    const outboxCount = await db.outbox.count();
    const auditCount = await db.auditLog.count();
    const stock = await db.stockLevels.get(productId);

    expect(salesCount).toBe(0);
    expect(movementsCount).toBe(0);
    expect(outboxCount).toBe(0);
    expect(auditCount).toBe(0);
    expect(stock?.qty).toBe(10000); // reverted to original value!
  });

  it('records cash movement with outbox and audit log atomically', async () => {
    await withTx(db, testContext, async (scope) => {
      await scope.recordCashMovement({
        movement: {
          id: '018f0000-0000-7000-8000-000000000088',
          shiftId: '018f0000-0000-7000-8000-000000000005',
          type: 'in',
          amount: 5000,
          reason: 'Initial float addition',
          createdBy: testContext.userId,
          createdAt: fakeClock.now().toISOString(),
        },
      });
    });

    expect(await db.cashMovements.count()).toBe(1);
    expect(await db.outbox.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(1);

    const outbox = await db.outbox.toCollection().first();
    expect(outbox?.entity).toBe('cash_movement');

    const audit = await db.auditLog.toCollection().first();
    expect(audit?.action).toBe('cash:in');
  });

  it('records custom mutation with outbox and audit log atomically', async () => {
    const result = await withTx(db, testContext, async (scope) => {
      return scope.recordCustomMutation({
        entity: 'customer',
        entityId: '018f0000-0000-7000-8000-000000000777',
        op: 'create',
        payload: { name: 'Juan Perez' },
        auditAction: 'customer:create',
        mutate: async () => {
          await db.customers.add({
            id: '018f0000-0000-7000-8000-000000000777',
            name: 'Juan Perez',
            custom: {},
            version: 1,
            updatedAt: fakeClock.now().toISOString(),
          });
          return 'SUCCESS_RESULT';
        },
      });
    });

    expect(result).toBe('SUCCESS_RESULT');
    expect(await db.customers.count()).toBe(1);
    expect(await db.outbox.count()).toBe(1);
    expect(await db.auditLog.count()).toBe(1);
  });
});
