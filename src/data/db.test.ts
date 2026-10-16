import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createAppDatabase, type Migration } from './db';
import type { OutboxItem, Product, Sale } from '@/domain';

describe('AppDatabase (Dexie v1 schema & migrations)', () => {
  it('initializes all 17 tables defined in SPEC §5.4', () => {
    const testDb = createAppDatabase(`test_db_${Date.now()}_1`);

    const expectedTables = [
      'meta',
      'users',
      'settings',
      'taxRates',
      'categories',
      'products',
      'customers',
      'customFieldDefs',
      'sales',
      'saleVoids',
      'saleReturns',
      'shifts',
      'cashMovements',
      'inventoryMovements',
      'stockLevels',
      'heldCarts',
      'outbox',
      'auditLog',
    ];

    for (const tableName of expectedTables) {
      expect(testDb.table(tableName)).toBeDefined();
    }
  });

  it('enforces unique index &number on sales table', async () => {
    const testDb = createAppDatabase(`test_db_${Date.now()}_sales`);

    const sale1: Sale = {
      id: '018f0000-0000-7000-8000-000000000001',
      number: 'L01-000001',
      deviceId: '018f0000-0000-7000-8000-000000000000',
      shiftId: null,
      cashierId: '018f0000-0000-7000-8000-000000000010',
      status: 'completed',
      lines: [],
      totals: {
        subtotal: 1000,
        lineDiscounts: 0,
        orderDiscount: 0,
        tax: 0,
        roundingAdjustment: 0,
        total: 1000,
        taxBreakdown: [],
      },
      payments: [
        {
          id: '018f0000-0000-7000-8000-000000000020',
          method: 'cash',
          amount: 1000,
          createdAt: new Date().toISOString(),
        },
      ],
      change: 0,
      pricesIncludeTax: false,
      currency: 'USD',
      custom: {},
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    await testDb.sales.add(sale1);

    const duplicateSale: Sale = {
      ...sale1,
      id: '018f0000-0000-7000-8000-000000000002', // different ID, same number
    };

    await expect(testDb.sales.add(duplicateSale)).rejects.toThrow();
  });

  it('auto-increments seq and enforces unique eventId in outbox', async () => {
    const testDb = createAppDatabase(`test_db_${Date.now()}_outbox`);

    const item1: OutboxItem = {
      eventId: '018f0000-0000-7000-8000-000000000050',
      entity: 'sale',
      entityId: '018f0000-0000-7000-8000-000000000001',
      op: 'create',
      payload: { test: true },
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    };

    const seq1 = await testDb.outbox.add(item1);
    expect(seq1).toBe(1);

    const item2: OutboxItem = {
      eventId: '018f0000-0000-7000-8000-000000000051',
      entity: 'sale',
      entityId: '018f0000-0000-7000-8000-000000000002',
      op: 'create',
      payload: { test: 2 },
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    };

    const seq2 = await testDb.outbox.add(item2);
    expect(seq2).toBe(2);

    // Duplicate eventId should fail
    const itemDuplicateEvent: OutboxItem = {
      ...item2,
      eventId: '018f0000-0000-7000-8000-000000000050', // same as item1
    };

    await expect(testDb.outbox.add(itemDuplicateEvent)).rejects.toThrow();
  });

  it('supports multi-entry barcode querying in products', async () => {
    const testDb = createAppDatabase(`test_db_${Date.now()}_products`);

    const product: Product = {
      id: '018f0000-0000-7000-8000-000000000100',
      version: 1,
      sku: 'COCA-350',
      barcodes: ['7501055300075', '7501055300082'],
      name: 'Coca Cola 350ml',
      priceMinor: 1500,
      taxRateId: '018f0000-0000-7000-8000-000000000000',
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: true,
      custom: {},
      updatedAt: new Date().toISOString(),
    };

    await testDb.products.add(product);

    const foundByFirstBarcode = await testDb.products
      .where('barcodes')
      .equals('7501055300075')
      .first();
    const foundBySecondBarcode = await testDb.products
      .where('barcodes')
      .equals('7501055300082')
      .first();

    expect(foundByFirstBarcode?.id).toBe(product.id);
    expect(foundBySecondBarcode?.id).toBe(product.id);
  });

  it('executes schema migrations seamlessly with upgrade functions', async () => {
    const dbName = `test_db_migration_${Date.now()}`;

    // Step 1: Open version 1 and populate some data
    const dbV1 = createAppDatabase(dbName);
    await dbV1.meta.put({ key: 'version_check', value: 1 });
    await dbV1.close();

    // Step 2: Open with migration to version 2
    const migrationV2: Migration = {
      version: 2,
      stores: {
        legacyNotes: 'id, createdAt',
      },
      upgrade: async (tx) => {
        const metaTable = tx.table('meta');
        await metaTable.put({ key: 'version_check', value: 2 });
      },
    };

    const dbV2 = createAppDatabase(dbName, {
      customMigrations: [migrationV2],
    });

    const updatedMeta = await dbV2.meta.get('version_check');
    expect(updatedMeta?.value).toBe(2);
    expect(dbV2.table('legacyNotes')).toBeDefined();
    await dbV2.close();
  });
});
