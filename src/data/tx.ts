import {
  type AuditEntry,
  type CashMovement,
  type Clock,
  type InventoryMovement,
  type OutboxItem,
  type OutboxOp,
  type Sale,
  type SaleReturn,
  type SaleVoid,
  SystemClock,
  type UUID,
  v7,
} from '@/domain';
import type { AppDatabase } from './db';

export interface TxContext {
  userId: UUID;
  clock?: Clock;
  description?: string;
}

export interface RecordSaleParams {
  sale: Sale;
  productStockTrackMap?: Record<UUID, boolean>; // productId -> trackStock
  auditAction?: string;
  auditDetails?: Record<string, unknown>;
}

export interface RecordSaleVoidParams {
  saleVoid: SaleVoid;
  sale: Sale;
  productStockTrackMap?: Record<UUID, boolean>;
  auditDetails?: Record<string, unknown>;
}

export interface RecordSaleReturnParams {
  saleReturn: SaleReturn;
  productStockTrackMap?: Record<UUID, boolean>;
  refundLines: { lineId: UUID; productId: UUID; qty: number }[];
  auditDetails?: Record<string, unknown>;
}

export interface RecordInventoryMovementParams {
  movement: InventoryMovement;
  auditAction?: string;
  auditDetails?: Record<string, unknown>;
}

export interface RecordCashMovementParams {
  movement: CashMovement;
  auditDetails?: Record<string, unknown>;
}

export interface RecordCustomMutationParams<T> {
  entity: string;
  entityId: UUID;
  op: OutboxOp;
  payload: unknown;
  auditAction: string;
  auditDetails?: Record<string, unknown>;
  mutate: () => Promise<T>;
}

export class TxScope {
  constructor(
    public readonly db: AppDatabase,
    public readonly context: TxContext,
    private readonly clock: Clock,
  ) {}

  async recordSale(params: RecordSaleParams): Promise<void> {
    const { sale, productStockTrackMap, auditAction = 'sale:create', auditDetails } = params;
    const nowIso = this.clock.now().toISOString();

    // 1. Add sale
    await this.db.sales.add(sale);

    // 2. Inventory movements & stock level cache updates
    for (const line of sale.lines) {
      const tracksStock = productStockTrackMap ? productStockTrackMap[line.productId] : true;
      if (tracksStock) {
        const invMovement: InventoryMovement = {
          id: v7(this.clock.now()),
          productId: line.productId,
          qty: -Math.abs(line.qty), // negative for outbound sale
          type: 'sale',
          refType: 'sale',
          refId: sale.id,
          createdBy: this.context.userId,
          createdAt: nowIso,
        };
        await this.db.inventoryMovements.add(invMovement);

        const currentStock = await this.db.stockLevels.get(line.productId);
        const existingQty = currentStock ? currentStock.qty : 0;
        await this.db.stockLevels.put({
          productId: line.productId,
          qty: existingQty - Math.abs(line.qty),
        });
      }
    }

    // 3. Outbox event
    const outboxItem: OutboxItem = {
      eventId: v7(this.clock.now()),
      entity: 'sale',
      entityId: sale.id,
      op: 'create',
      payload: sale,
      schemaVersion: 1,
      occurredAt: nowIso,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    };
    await this.db.outbox.add(outboxItem);

    // 4. Audit entry
    const auditEntry: AuditEntry = {
      id: v7(this.clock.now()),
      ts: nowIso,
      userId: this.context.userId,
      action: auditAction,
      entity: 'sale',
      entityId: sale.id,
      details: {
        number: sale.number,
        total: sale.totals.total,
        ...auditDetails,
      },
    };
    await this.db.auditLog.add(auditEntry);
  }

  async recordInventoryMovement(params: RecordInventoryMovementParams): Promise<void> {
    const { movement, auditAction = 'inventory:adjust', auditDetails } = params;
    const nowIso = this.clock.now().toISOString();

    await this.db.inventoryMovements.add(movement);

    const currentStock = await this.db.stockLevels.get(movement.productId);
    const existingQty = currentStock ? currentStock.qty : 0;
    await this.db.stockLevels.put({
      productId: movement.productId,
      qty: existingQty + movement.qty,
    });

    const outboxItem: OutboxItem = {
      eventId: v7(this.clock.now()),
      entity: 'inventory_adjustment',
      entityId: movement.id,
      op: 'create',
      payload: movement,
      schemaVersion: 1,
      occurredAt: nowIso,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    };
    await this.db.outbox.add(outboxItem);

    const auditEntry: AuditEntry = {
      id: v7(this.clock.now()),
      ts: nowIso,
      userId: this.context.userId,
      action: auditAction,
      entity: 'inventoryMovement',
      entityId: movement.id,
      details: {
        productId: movement.productId,
        qty: movement.qty,
        type: movement.type,
        ...auditDetails,
      },
    };
    await this.db.auditLog.add(auditEntry);
  }

  async recordCashMovement(params: RecordCashMovementParams): Promise<void> {
    const { movement, auditDetails } = params;
    const nowIso = this.clock.now().toISOString();

    await this.db.cashMovements.add(movement);

    const outboxItem: OutboxItem = {
      eventId: v7(this.clock.now()),
      entity: 'cash_movement',
      entityId: movement.id,
      op: 'create',
      payload: movement,
      schemaVersion: 1,
      occurredAt: nowIso,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    };
    await this.db.outbox.add(outboxItem);

    const auditEntry: AuditEntry = {
      id: v7(this.clock.now()),
      ts: nowIso,
      userId: this.context.userId,
      action: `cash:${movement.type}`,
      entity: 'cashMovement',
      entityId: movement.id,
      details: {
        shiftId: movement.shiftId,
        amount: movement.amount,
        reason: movement.reason,
        ...auditDetails,
      },
    };
    await this.db.auditLog.add(auditEntry);
  }

  async recordCustomMutation<T>(params: RecordCustomMutationParams<T>): Promise<T> {
    const { entity, entityId, op, payload, auditAction, auditDetails, mutate } = params;
    const nowIso = this.clock.now().toISOString();

    const result = await mutate();

    const outboxItem: OutboxItem = {
      eventId: v7(this.clock.now()),
      entity,
      entityId,
      op,
      payload,
      schemaVersion: 1,
      occurredAt: nowIso,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    };
    await this.db.outbox.add(outboxItem);

    const auditEntry: AuditEntry = {
      id: v7(this.clock.now()),
      ts: nowIso,
      userId: this.context.userId,
      action: auditAction,
      entity,
      entityId,
      details: auditDetails,
    };
    await this.db.auditLog.add(auditEntry);

    return result;
  }
}

export const TRANSACTIONAL_TABLES = [
  'sales',
  'saleVoids',
  'saleReturns',
  'shifts',
  'cashMovements',
  'inventoryMovements',
  'stockLevels',
  'outbox',
  'auditLog',
  'meta',
  'products',
  'customers',
  'heldCarts',
] as const;

export async function withTx<T>(
  db: AppDatabase,
  context: TxContext,
  fn: (scope: TxScope) => Promise<T>,
): Promise<T> {
  const clock = context.clock ?? new SystemClock();
  const scope = new TxScope(db, context, clock);

  const tableInstances = TRANSACTIONAL_TABLES.map((name) => db.table(name));

  return db.transaction('rw', tableInstances, async () => {
    return fn(scope);
  });
}
