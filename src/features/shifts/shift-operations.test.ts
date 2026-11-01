import { describe, it, expect, beforeEach } from 'vitest';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import {
  openShift,
  addCashMovement,
  getShiftSummary,
  getCurrentShiftSummary,
  closeShift,
} from './shift-operations';
import { type Clock, type Sale, type UUID, v7 } from '@/domain';

class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-11-01T10:00:00.000Z')) {}
  now(): Date {
    return this.current;
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

describe('shift-operations', () => {
  let db: AppDatabase;
  let clock: FakeClock;
  const cashierId: UUID = '018f0000-0000-7000-8000-000000000001' as UUID;
  const deviceId: UUID = '018f0000-0000-7000-8000-000000000002' as UUID;

  beforeEach(async () => {
    db = createAppDatabase(`pos_shift_ops_test_${Date.now()}_${Math.random()}`);
    clock = new FakeClock();
    await db.meta.put({ key: 'deviceId', value: deviceId });
  });

  describe('openShift', () => {
    it('opens a new shift with initial float and records outbox + audit', async () => {
      const shift = await openShift(db, {
        cashierId,
        openingFloat: 50000, // $500.00
        clock,
      });

      expect(shift.status).toBe('open');
      expect(shift.openingFloat).toBe(50000);
      expect(shift.openedBy).toBe(cashierId);
      expect(shift.deviceId).toBe(deviceId);
      expect(shift.openedAt).toBe(clock.now().toISOString());

      // Check DB
      const stored = await db.shifts.get(shift.id);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe('open');

      // Check outbox
      const outbox = (await db.outbox.toArray()).filter((o) => o.entityId === shift.id);
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.entity).toBe('shift');
      expect(outbox[0]?.op).toBe('create');

      // Check audit
      const audit = (await db.auditLog.toArray()).filter((a) => a.entityId === shift.id);
      expect(audit).toHaveLength(1);
      expect(audit[0]?.action).toBe('shift:opened');
      expect(audit[0]?.details?.openingFloat).toBe(50000);
    });

    it('rejects negative opening float', async () => {
      await expect(
        openShift(db, {
          cashierId,
          openingFloat: -100,
          clock,
        }),
      ).rejects.toThrow('no puede ser negativo');
    });

    it('enforces single open shift per device', async () => {
      await openShift(db, {
        cashierId,
        openingFloat: 10000,
        clock,
      });

      await expect(
        openShift(db, {
          cashierId,
          openingFloat: 20000,
          clock,
        }),
      ).rejects.toThrow('Ya existe un turno abierto');
    });
  });

  describe('addCashMovement', () => {
    it('records cash in and cash out with outbox and audit events', async () => {
      const shift = await openShift(db, {
        cashierId,
        openingFloat: 20000,
        clock,
      });

      const cashIn = await addCashMovement(db, {
        cashierId,
        type: 'in',
        amount: 15000,
        reason: 'Aportación de cambio',
        clock,
      });

      expect(cashIn.shiftId).toBe(shift.id);
      expect(cashIn.type).toBe('in');
      expect(cashIn.amount).toBe(15000);
      expect(cashIn.reason).toBe('Aportación de cambio');

      const cashOut = await addCashMovement(db, {
        cashierId,
        type: 'out',
        amount: 5000,
        reason: 'Pago de mensajería',
        clock,
      });

      expect(cashOut.shiftId).toBe(shift.id);
      expect(cashOut.type).toBe('out');
      expect(cashOut.amount).toBe(5000);

      // Verify audit entries
      const inAudit = (await db.auditLog.toArray()).find((a) => a.entityId === cashIn.id);
      expect(inAudit?.action).toBe('cash_movement:in');
      expect(inAudit?.details?.amount).toBe(15000);

      const outAudit = (await db.auditLog.toArray()).find((a) => a.entityId === cashOut.id);
      expect(outAudit?.action).toBe('cash_movement:out');
      expect(outAudit?.details?.amount).toBe(5000);
    });

    it('rejects cash movement if no shift is open', async () => {
      await expect(
        addCashMovement(db, {
          cashierId,
          type: 'in',
          amount: 5000,
          reason: 'Prueba',
          clock,
        }),
      ).rejects.toThrow('No hay ningún turno abierto');
    });

    it('rejects cash movement with zero or negative amount or empty reason', async () => {
      await openShift(db, { cashierId, openingFloat: 1000, clock });

      await expect(
        addCashMovement(db, {
          cashierId,
          type: 'in',
          amount: 0,
          reason: 'Test',
          clock,
        }),
      ).rejects.toThrow('mayor a 0');

      await expect(
        addCashMovement(db, {
          cashierId,
          type: 'out',
          amount: 1000,
          reason: '   ',
          clock,
        }),
      ).rejects.toThrow('motivo');
    });
  });

  describe('closeShift and getShiftSummary', () => {
    it('accurately calculates expectedCash and differences (shortage, overage, balanced)', async () => {
      const shift = await openShift(db, {
        cashierId,
        openingFloat: 10000, // $100.00
        clock,
      });

      // Insert a cash sale of $25.00 (2500 cents) and a card sale of $50.00 (5000 cents)
      const sale1: Sale = {
        id: v7(),
        number: 'L01-000001',
        deviceId,
        shiftId: shift.id,
        cashierId,
        customerId: null,
        status: 'completed',
        lines: [],
        totals: {
          subtotal: 7500,
          lineDiscounts: 0,
          orderDiscount: 0,
          totalDiscount: 0,
          tax: 0,
          total: 7500,
          taxBreakdown: [],
        },
        payments: [
          { method: 'cash', amount: 2500 },
          { method: 'card', amount: 5000 },
        ],
        change: 0,
        pricesIncludeTax: true,
        completedAt: clock.now().toISOString(),
        receiptPrinted: false,
      };
      await db.sales.add(sale1);

      // Add cash in +$30.00 (3000 cents)
      await addCashMovement(db, {
        cashierId,
        type: 'in',
        amount: 3000,
        reason: 'Cambio',
        clock,
      });

      // Add cash out -$10.00 (1000 cents)
      await addCashMovement(db, {
        cashierId,
        type: 'out',
        amount: 1000,
        reason: 'Insumos',
        clock,
      });

      // expectedCash = 10000 (float) + 2500 (cash sales) + 3000 (in) - 1000 (out) = 14500 ($145.00)
      const currentSummary = await getCurrentShiftSummary(db);
      expect(currentSummary?.expectedCash).toBe(14500);
      expect(currentSummary?.sales.cashSalesTotal).toBe(2500);
      expect(currentSummary?.sales.payments['card']?.total).toBe(5000);
      expect(currentSummary?.movements.inTotal).toBe(3000);
      expect(currentSummary?.movements.outTotal).toBe(1000);

      const directSummary = await getShiftSummary(db, shift.id);
      expect(directSummary.expectedCash).toBe(14500);

      // Scenario: Cashier counts 15000 (500 overage)
      clock.advance(3600000); // 1 hour later
      const result = await closeShift(db, {
        cashierId,
        countedCash: 15000,
        clock,
      });

      expect(result.shift.status).toBe('closed');
      expect(result.shift.expectedCash).toBe(14500);
      expect(result.shift.countedCash).toBe(15000);
      expect(result.shift.difference).toBe(500); // +$5.00 overage
      expect(result.shift.closedBy).toBe(cashierId);
      expect(result.shift.closedAt).toBe(clock.now().toISOString());

      // DB check
      const closedFromDb = await db.shifts.get(shift.id);
      expect(closedFromDb?.status).toBe('closed');
      expect(closedFromDb?.difference).toBe(500);

      // Outbox check (update event)
      const outbox = (await db.outbox.toArray()).filter((o) => o.entityId === shift.id);
      const closeEvent = outbox.find((o) => o.op === 'update');
      expect(closeEvent).toBeDefined();

      // Audit check
      const audit = (await db.auditLog.toArray()).filter((a) => a.entityId === shift.id);
      const closeAudit = audit.find((a) => a.action === 'shift:closed');
      expect(closeAudit).toBeDefined();
      expect(closeAudit?.details?.difference).toBe(500);

      // Verify no open shift remains
      const remainingOpen = await getCurrentShiftSummary(db);
      expect(remainingOpen).toBeNull();
    });

    it('rejects closing if no open shift exists', async () => {
      await expect(
        closeShift(db, {
          cashierId,
          countedCash: 1000,
          clock,
        }),
      ).rejects.toThrow('No hay ningún turno abierto');
    });
  });
});
