import type {
  CartState,
  Clock,
  CurrencyConfig,
  Minor,
  Payment,
  Sale,
  Settings,
  UUID,
} from '@/domain';
import { SystemClock } from '@/domain';
import type { AppDatabase } from '@/data/db';
import { withTx } from '@/data/tx';

export interface CompleteSaleParams {
  saleId: UUID;
  cart: CartState;
  payments: Payment[];
  change: Minor;
  cashierId: UUID;
  currency: CurrencyConfig;
  settings?: Settings | null;
  clock?: Clock;
}

/**
 * Completes a sale within a single atomic Dexie transaction according to SPEC §5.2, §6.3, §6.4.
 *
 * Guarantees:
 * 1. Idempotency: Returns existing sale without duplicate increments or stock deductions if saleId already exists.
 * 2. Correlative numbering: Atomically increments meta.saleSeq and formats `${series}-${seq}` (e.g. L01-000001).
 * 3. Inventory: Decrements stock for products with trackStock: true and updates stockLevels cache.
 * 4. Outbox: Enqueues 'sale' 'create' event in the same transaction.
 * 5. Audit: Logs 'sale:create' in auditLog.
 * 6. Clean draft: Removes active cart draft from meta.
 */
export async function completeSale(db: AppDatabase, params: CompleteSaleParams): Promise<Sale> {
  const {
    saleId,
    cart,
    payments,
    change,
    cashierId,
    currency,
    settings,
    clock = new SystemClock(),
  } = params;

  if (cart.lines.length === 0) {
    throw new Error('No se puede completar una venta sin productos.');
  }

  return withTx(
    db,
    {
      userId: cashierId,
      clock,
      description: 'completeSale',
    },
    async (scope) => {
      // 1. Idempotency check: if sale already exists, return it immediately without duplicating
      const existingSale = await scope.db.sales.get(saleId);
      if (existingSale) {
        return existingSale;
      }

      // 2. Shift validation (SPEC §6.5)
      const openShift = await scope.db.shifts.where('status').equals('open').first();
      const requireShift = settings?.requireShift ?? false;
      if (requireShift && !openShift) {
        throw new Error('No hay un turno abierto para registrar ventas.');
      }
      const shiftId = openShift ? openShift.id : null;

      // 3. Device series and correlative numbering (SPEC §6.4)
      const seriesRow = await scope.db.meta.get('series');
      const series = (seriesRow?.value as string) || 'L01';

      const seqRow = await scope.db.meta.get('saleSeq');
      const currentSeq = typeof seqRow?.value === 'number' ? seqRow.value : 0;
      const nextSeq = currentSeq + 1;
      await scope.db.meta.put({ key: 'saleSeq', value: nextSeq });

      const saleNumber = `${series}-${String(nextSeq).padStart(6, '0')}`;

      // 4. Device ID
      const deviceIdRow = await scope.db.meta.get('deviceId');
      const deviceId =
        (deviceIdRow?.value as UUID) || ('00000000-0000-0000-0000-000000000000' as UUID);

      // 5. Look up stock tracking setting for line products
      const productIds = Array.from(new Set(cart.lines.map((l) => l.productId)));
      const products = await Promise.all(productIds.map((id) => scope.db.products.get(id)));
      const productStockTrackMap: Record<UUID, boolean> = {};
      for (const p of products) {
        if (p) {
          productStockTrackMap[p.id] = p.trackStock;
        }
      }

      const nowIso = clock.now().toISOString();

      // 6. Build immutable Sale document (SPEC §5.2)
      const sale: Sale = {
        id: saleId,
        number: saleNumber,
        deviceId,
        shiftId,
        cashierId,
        customerId: cart.customerId ?? null,
        status: 'completed',
        lines: cart.lines.map((l) => ({ ...l })),
        orderDiscount: cart.orderDiscount ? { ...cart.orderDiscount } : undefined,
        totals: {
          ...cart.totals,
          taxBreakdown: cart.totals.taxBreakdown.map((t) => ({ ...t })),
        },
        payments: payments.map((p) => ({ ...p })),
        change,
        pricesIncludeTax: cart.pricesIncludeTax,
        currency: currency.code,
        notes: cart.notes,
        custom: {},
        fiscal: null,
        createdAt: nowIso,
        completedAt: nowIso,
        schemaVersion: 1,
      };

      // 7. Atomic writes via TxScope (Sales, InventoryMovements, StockLevels, Outbox, Audit)
      await scope.recordSale({
        sale,
        productStockTrackMap,
        auditAction: 'sale:create',
        auditDetails: {
          number: sale.number,
          total: sale.totals.total,
          paymentsCount: sale.payments.length,
          change: sale.change,
        },
      });

      // 8. Delete active cart draft from meta
      await scope.db.meta.delete('pos_active_cart_draft');

      return sale;
    },
  );
}
