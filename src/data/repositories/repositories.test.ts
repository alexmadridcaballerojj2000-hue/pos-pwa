import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '../db';
import { createRepositories, type Repositories } from './index';
import type {
  AuditEntry,
  Category,
  OutboxItem,
  Product,
  Sale,
  Settings,
  Shift,
  TaxRate,
  User,
} from '@/domain';

describe('Dexie Repositories (domain port implementations)', () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    db = createAppDatabase(`test_repo_${Date.now()}_${Math.random()}`);
    repos = createRepositories(db);
  });

  describe('UserRepository', () => {
    it('creates, retrieves by ID, and lists only active users', async () => {
      const activeUser: User = {
        id: '018f0000-0000-7000-8000-000000000001',
        name: 'Alice Cashier',
        role: 'cashier',
        active: true,
        pin: { hash: 'hash1', salt: 'salt1', iterations: 210000 },
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      const inactiveUser: User = {
        id: '018f0000-0000-7000-8000-000000000002',
        name: 'Bob Former',
        role: 'cashier',
        active: false,
        pin: { hash: 'hash2', salt: 'salt2', iterations: 210000 },
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await repos.users.create(activeUser);
      await repos.users.create(inactiveUser);

      const found = await repos.users.getById(activeUser.id);
      expect(found).toEqual(activeUser);

      const activeList = await repos.users.listActive();
      expect(activeList).toHaveLength(1);
      expect(activeList[0]?.id).toBe(activeUser.id);

      // Update user
      const updatedUser: User = { ...activeUser, name: 'Alice Manager', role: 'manager' };
      await repos.users.update(updatedUser);
      const reFetched = await repos.users.getById(activeUser.id);
      expect(reFetched?.role).toBe('manager');
      expect(reFetched?.name).toBe('Alice Manager');
    });
  });

  describe('SettingsRepository', () => {
    it('saves and retrieves singleton settings', async () => {
      const initial = await repos.settings.get();
      expect(initial).toBeNull();

      const settings: Settings = {
        id: 'singleton',
        business: { name: 'Mi Tiendita', taxId: 'RFC123456' },
        currency: { code: 'USD', decimals: 2, symbol: '$' },
        pricesIncludeTax: true,
        requireShift: true,
        allowNegativeStock: true,
        maxDiscountBp: 1000,
        paymentMethods: [
          { id: 'cash', label: 'Efectivo', kind: 'cash', active: true, requireReference: false },
        ],
        modules: {},
        receipt: { paperWidthMm: 80, template: {} },
        mode: 'local',
      };

      await repos.settings.save(settings);
      const retrieved = await repos.settings.get();
      expect(retrieved).toEqual(settings);
    });
  });

  describe('ProductRepository', () => {
    it('saves and retrieves products by id, barcode, sku, and active status', async () => {
      const product1: Product = {
        id: '018f0000-0000-7000-8000-000000000010',
        sku: 'SKU-001',
        barcodes: ['111111111111', '222222222222'],
        name: 'Soda 500ml',
        priceMinor: 2000,
        taxRateId: '018f0000-0000-7000-8000-000000000000',
        trackStock: true,
        unit: 'unit',
        allowFractional: false,
        active: true,
        custom: {},
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      const product2: Product = {
        id: '018f0000-0000-7000-8000-000000000011',
        sku: 'SKU-002',
        barcodes: ['333333333333'],
        name: 'Discontinued Snack',
        priceMinor: 1000,
        taxRateId: '018f0000-0000-7000-8000-000000000000',
        trackStock: false,
        unit: 'unit',
        allowFractional: false,
        active: false,
        custom: {},
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await repos.products.save(product1);
      await repos.products.save(product2);

      expect(await repos.products.getById(product1.id)).toEqual(product1);
      expect(await repos.products.getByBarcode('222222222222')).toEqual(product1);
      expect(await repos.products.getBySku('SKU-002')).toEqual(product2);

      const activeOnly = await repos.products.listActive();
      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0]?.id).toBe(product1.id);
    });
  });

  describe('TaxRateRepository & CategoryRepository', () => {
    it('manages tax rates and categories ordered by sort', async () => {
      const tax: TaxRate = {
        id: '018f0000-0000-7000-8000-000000000020',
        name: 'IVA 16%',
        rateBp: 1600,
        active: true,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await repos.taxRates.save(tax);
      expect(await repos.taxRates.getById(tax.id)).toEqual(tax);
      const activeTaxes = await repos.taxRates.listActive();
      expect(activeTaxes).toHaveLength(1);

      const cat1: Category = {
        id: '018f0000-0000-7000-8000-000000000030',
        name: 'Bebidas',
        sort: 2,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      const cat2: Category = {
        id: '018f0000-0000-7000-8000-000000000031',
        name: 'Abarrotes',
        sort: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await repos.categories.save(cat1);
      await repos.categories.save(cat2);

      const list = await repos.categories.list();
      expect(list).toHaveLength(2);
      expect(list[0]?.name).toBe('Abarrotes'); // sort 1 before 2
      expect(list[1]?.name).toBe('Bebidas');
    });
  });

  describe('SaleRepository', () => {
    it('saves and finds sale by id, number, and shift', async () => {
      const shiftId = '018f0000-0000-7000-8000-000000000040';
      const sale: Sale = {
        id: '018f0000-0000-7000-8000-000000000041',
        number: 'L01-000042',
        deviceId: '018f0000-0000-7000-8000-000000000000',
        shiftId,
        cashierId: '018f0000-0000-7000-8000-000000000001',
        status: 'completed',
        lines: [],
        totals: {
          subtotal: 5000,
          lineDiscounts: 0,
          orderDiscount: 0,
          tax: 0,
          roundingAdjustment: 0,
          total: 5000,
          taxBreakdown: [],
        },
        payments: [
          {
            id: '018f0000-0000-7000-8000-000000000043',
            method: 'cash',
            amount: 5000,
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

      await repos.sales.save(sale);

      expect(await repos.sales.getById(sale.id)).toEqual(sale);
      expect(await repos.sales.getByNumber('L01-000042')).toEqual(sale);

      const shiftSales = await repos.sales.listByShift(shiftId);
      expect(shiftSales).toHaveLength(1);
      expect(shiftSales[0]?.id).toBe(sale.id);
    });
  });

  describe('ShiftRepository', () => {
    it('handles open, query current open, and close shifts', async () => {
      const shift: Shift = {
        id: '018f0000-0000-7000-8000-000000000060',
        deviceId: '018f0000-0000-7000-8000-000000000000',
        openedBy: '018f0000-0000-7000-8000-000000000001',
        openedAt: new Date().toISOString(),
        openingFloat: 10000,
        status: 'open',
      };

      await repos.shifts.open(shift);
      const current = await repos.shifts.getCurrentOpen();
      expect(current?.id).toBe(shift.id);

      const closed: Shift = {
        ...shift,
        status: 'closed',
        closedBy: '018f0000-0000-7000-8000-000000000001',
        closedAt: new Date().toISOString(),
        countedCash: 15000,
        expectedCash: 15000,
        difference: 0,
      };

      await repos.shifts.close(closed);
      const afterClose = await repos.shifts.getCurrentOpen();
      expect(afterClose).toBeNull();
      const byId = await repos.shifts.getById(shift.id);
      expect(byId?.status).toBe('closed');
    });
  });

  describe('OutboxRepository', () => {
    it('enqueues, counts, lists pending, and updates status', async () => {
      const item: OutboxItem = {
        eventId: '018f0000-0000-7000-8000-000000000070',
        entity: 'sale',
        entityId: '018f0000-0000-7000-8000-000000000041',
        op: 'create',
        payload: { saleNumber: 'L01-000042' },
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        status: 'pending',
        attempts: 0,
        nextAttemptAt: 0,
      };

      const seq = await repos.outbox.enqueue(item);
      expect(seq).toBeGreaterThan(0);

      const pendingCount = await repos.outbox.countByStatus('pending');
      expect(pendingCount).toBe(1);

      const pendingList = await repos.outbox.listPending();
      expect(pendingList).toHaveLength(1);
      expect(pendingList[0]?.eventId).toBe(item.eventId);

      await repos.outbox.markStatus(seq, 'synced');
      expect(await repos.outbox.countByStatus('pending')).toBe(0);
      expect(await repos.outbox.countByStatus('synced')).toBe(1);
    });
  });

  describe('AuditRepository & MetaRepository', () => {
    it('records and lists audit entries in reverse chronological order', async () => {
      const entry1: AuditEntry = {
        id: '018f0000-0000-7000-8000-000000000080',
        ts: '2026-01-01T10:00:00Z',
        userId: '018f0000-0000-7000-8000-000000000001',
        action: 'login',
        entity: 'user',
      };
      const entry2: AuditEntry = {
        id: '018f0000-0000-7000-8000-000000000081',
        ts: '2026-01-01T10:05:00Z',
        userId: '018f0000-0000-7000-8000-000000000001',
        action: 'open_shift',
        entity: 'shift',
      };

      await repos.audit.log(entry1);
      await repos.audit.log(entry2);

      const recent = await repos.audit.listRecent();
      expect(recent).toHaveLength(2);
      expect(recent[0]?.id).toBe(entry2.id); // newer first
      expect(recent[1]?.id).toBe(entry1.id);
    });

    it('stores and retrieves arbitrary typed values in meta', async () => {
      await repos.meta.set('deviceId', '018f0000-0000-7000-8000-000000000000');
      await repos.meta.set('saleSeq', 42);

      expect(await repos.meta.get<string>('deviceId')).toBe('018f0000-0000-7000-8000-000000000000');
      expect(await repos.meta.get<number>('saleSeq')).toBe(42);
      expect(await repos.meta.get<boolean>('non_existent')).toBeNull();
    });
  });
});
