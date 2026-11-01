import {
  type CashMovement,
  type Clock,
  type Minor,
  type Shift,
  type ShiftSummary,
  SystemClock,
  type UUID,
  calculateShiftDifference,
  summarizeShift,
  v7,
} from '@/domain';
import type { AppDatabase } from '@/data/db';
import { withTx } from '@/data/tx';

export interface OpenShiftParams {
  cashierId: UUID;
  openingFloat: Minor;
  clock?: Clock;
  deviceId?: UUID;
}

export interface AddCashMovementParams {
  cashierId: UUID;
  type: 'in' | 'out';
  amount: Minor;
  reason: string;
  clock?: Clock;
}

export interface CloseShiftParams {
  cashierId: UUID;
  countedCash: Minor;
  clock?: Clock;
}

export interface CloseShiftResult {
  shift: Shift;
  summary: ShiftSummary;
}

/**
 * Opens a new shift for the current device.
 * Enforces exactly one open shift per device according to SPEC §6.5.
 */
export async function openShift(db: AppDatabase, params: OpenShiftParams): Promise<Shift> {
  const { cashierId, openingFloat, clock = new SystemClock(), deviceId: customDeviceId } = params;

  if (openingFloat < 0) {
    throw new Error('El fondo inicial de caja no puede ser negativo.');
  }

  const existingOpen = await db.shifts.where('status').equals('open').first();
  if (existingOpen) {
    throw new Error(`Ya existe un turno abierto en este dispositivo (ID: ${existingOpen.id}).`);
  }

  let deviceId = customDeviceId;
  if (!deviceId) {
    const deviceIdRow = await db.meta.get('deviceId');
    deviceId = (deviceIdRow?.value as UUID) || ('00000000-0000-7000-8000-000000000000' as UUID);
  }

  const now = clock.now();
  const shift: Shift = {
    id: v7(now),
    deviceId,
    openedBy: cashierId,
    openedAt: now.toISOString(),
    openingFloat,
    status: 'open',
  };

  await withTx(
    db,
    {
      userId: cashierId,
      clock,
      description: 'openShift',
    },
    async (scope) => {
      // Re-verify inside tx to prevent race conditions
      const raceCheck = await scope.db.shifts.where('status').equals('open').first();
      if (raceCheck) {
        throw new Error('Ya existe un turno abierto en este dispositivo.');
      }
      await scope.recordShiftOpen({ shift });
    },
  );

  return shift;
}

/**
 * Records a cash movement (in/out) within the current active open shift.
 */
export async function addCashMovement(
  db: AppDatabase,
  params: AddCashMovementParams,
): Promise<CashMovement> {
  const { cashierId, type, amount, reason, clock = new SystemClock() } = params;

  if (amount <= 0) {
    throw new Error('El importe del movimiento de efectivo debe ser mayor a 0.');
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error('Debe especificar un motivo para el movimiento de caja.');
  }

  const openShift = await db.shifts.where('status').equals('open').first();
  if (!openShift) {
    throw new Error('No hay ningún turno abierto para registrar movimientos de efectivo.');
  }

  const now = clock.now();
  const movement: CashMovement = {
    id: v7(now),
    shiftId: openShift.id,
    type,
    amount,
    reason: trimmedReason,
    createdBy: cashierId,
    createdAt: now.toISOString(),
  };

  await withTx(
    db,
    {
      userId: cashierId,
      clock,
      description: `cashMovement:${type}`,
    },
    async (scope) => {
      await scope.recordCashMovement({ movement });
    },
  );

  return movement;
}

/**
 * Retrieves the complete financial summary for a given shift.
 */
export async function getShiftSummary(db: AppDatabase, shiftId: UUID): Promise<ShiftSummary> {
  const shift = await db.shifts.get(shiftId);
  if (!shift) {
    throw new Error(`Turno con ID ${shiftId} no encontrado.`);
  }

  const sales = await db.sales.where('shiftId').equals(shiftId).toArray();
  const movements = await db.cashMovements.where('shiftId').equals(shiftId).toArray();

  let cashReturns = 0;
  try {
    const saleReturns = await db.saleReturns.where('shiftId').equals(shiftId).toArray();
    for (const ret of saleReturns) {
      for (const refund of ret.refunds) {
        if (refund.method === 'cash') {
          cashReturns += refund.amount;
        }
      }
    }
  } catch {
    // If saleReturns table has no match or not used
    cashReturns = 0;
  }

  return summarizeShift(shift, sales, movements, cashReturns);
}

/**
 * Retrieves the financial summary for the currently active open shift, or null if none.
 */
export async function getCurrentShiftSummary(db: AppDatabase): Promise<ShiftSummary | null> {
  const openShift = await db.shifts.where('status').equals('open').first();
  if (!openShift) {
    return null;
  }
  return getShiftSummary(db, openShift.id);
}

/**
 * Closes the active shift with cash count reconciliation (SPEC §6.5).
 */
export async function closeShift(
  db: AppDatabase,
  params: CloseShiftParams,
): Promise<CloseShiftResult> {
  const { cashierId, countedCash, clock = new SystemClock() } = params;

  if (countedCash < 0) {
    throw new Error('El efectivo contado no puede ser negativo.');
  }

  const openShift = await db.shifts.where('status').equals('open').first();
  if (!openShift) {
    throw new Error('No hay ningún turno abierto para cerrar.');
  }

  const preSummary = await getShiftSummary(db, openShift.id);
  const expectedCash = preSummary.expectedCash;
  const difference = calculateShiftDifference(countedCash, expectedCash);

  const now = clock.now();
  const closedShift: Shift = {
    ...openShift,
    status: 'closed',
    closedBy: cashierId,
    closedAt: now.toISOString(),
    countedCash,
    expectedCash,
    difference,
  };

  await withTx(
    db,
    {
      userId: cashierId,
      clock,
      description: 'closeShift',
    },
    async (scope) => {
      await scope.recordShiftClose({ shift: closedShift });
    },
  );

  const finalSummary = await getShiftSummary(db, closedShift.id);

  return {
    shift: closedShift,
    summary: finalSummary,
  };
}
