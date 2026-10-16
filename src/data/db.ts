import Dexie, { type Table, type Transaction } from 'dexie';
import type {
  AuditEntry,
  CashMovement,
  Category,
  CustomFieldDef,
  Customer,
  HeldCart,
  InventoryMovement,
  MetaRow,
  OutboxItem,
  Product,
  Sale,
  SaleReturn,
  SaleVoid,
  Settings,
  Shift,
  StockLevel,
  TaxRate,
  User,
} from '@/domain';

export const SCHEMA_V1_STORES: Record<string, string> = {
  meta: 'key',
  users: 'id, name, role, active',
  settings: 'id',
  taxRates: 'id, active',
  categories: 'id, parentId, sort',
  products: 'id, sku, *barcodes, categoryId, name, active, updatedAt',
  customers: 'id, name, phone, taxId',
  customFieldDefs: 'id, entity',
  sales: 'id, &number, shiftId, cashierId, customerId, completedAt, [shiftId+completedAt]',
  saleVoids: 'id, saleId, shiftId',
  saleReturns: 'id, saleId, shiftId',
  shifts: 'id, status, openedAt',
  cashMovements: 'id, shiftId, createdAt',
  inventoryMovements: 'id, productId, createdAt, [productId+createdAt], [refType+refId]',
  stockLevels: 'productId',
  heldCarts: 'id, cashierId, createdAt',
  outbox: '++seq, &eventId, status, nextAttemptAt',
  auditLog: 'id, ts, userId, action',
};

export interface Migration {
  version: number;
  stores?: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

export interface AppDatabaseOptions {
  indexedDB?: IDBFactory;
  IDBKeyRange?: {
    bound(lower: unknown, upper: unknown, lowerOpen?: boolean, upperOpen?: boolean): IDBKeyRange;
    lowerBound(lower: unknown, open?: boolean): IDBKeyRange;
    upperBound(upper: unknown, open?: boolean): IDBKeyRange;
    only(value: unknown): IDBKeyRange;
  };
  customMigrations?: Migration[];
}

export class AppDatabase extends Dexie {
  meta!: Table<MetaRow, string>;
  users!: Table<User, string>;
  settings!: Table<Settings, string>;
  taxRates!: Table<TaxRate, string>;
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  customFieldDefs!: Table<CustomFieldDef, string>;
  sales!: Table<Sale, string>;
  saleVoids!: Table<SaleVoid, string>;
  saleReturns!: Table<SaleReturn, string>;
  shifts!: Table<Shift, string>;
  cashMovements!: Table<CashMovement, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  stockLevels!: Table<StockLevel, string>;
  heldCarts!: Table<HeldCart, string>;
  outbox!: Table<OutboxItem, number>;
  auditLog!: Table<AuditEntry, string>;

  constructor(dbName = 'pos_pwa_db', options?: AppDatabaseOptions) {
    const dexieOptions = options?.indexedDB
      ? {
          indexedDB: options.indexedDB,
          IDBKeyRange: options.IDBKeyRange as unknown as typeof IDBKeyRange,
        }
      : undefined;

    super(dbName, dexieOptions);

    this.version(1).stores(SCHEMA_V1_STORES);

    if (options?.customMigrations) {
      for (const m of options.customMigrations) {
        let v = this.version(m.version);
        if (m.stores) {
          v = v.stores(m.stores);
        }
        if (m.upgrade) {
          v.upgrade(m.upgrade);
        }
      }
    }
  }
}

export function createAppDatabase(
  dbName = 'pos_pwa_db',
  options?: AppDatabaseOptions,
): AppDatabase {
  return new AppDatabase(dbName, options);
}

export const db = createAppDatabase();
