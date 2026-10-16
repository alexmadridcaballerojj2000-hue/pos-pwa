import type {
  AuditEntry,
  Category,
  CustomFieldDef,
  OutboxItem,
  OutboxStatus,
  Product,
  Sale,
  Settings,
  Shift,
  TaxRate,
  User,
  UUID,
} from '../types';

export interface UserRepository {
  getById(id: UUID): Promise<User | null>;
  listActive(): Promise<User[]>;
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings | null>;
  save(settings: Settings): Promise<void>;
}

export interface ProductFilter {
  activeOnly?: boolean;
  categoryId?: UUID | null;
  search?: string;
}

export interface ProductRepository {
  getById(id: UUID): Promise<Product | null>;
  getByBarcode(barcode: string): Promise<Product | null>;
  getBySku(sku: string): Promise<Product | null>;
  list(filter?: ProductFilter): Promise<Product[]>;
  listActive(): Promise<Product[]>;
  save(product: Product): Promise<void>;
  delete(id: UUID): Promise<void>;
}

export interface TaxRateRepository {
  getById(id: UUID): Promise<TaxRate | null>;
  listActive(): Promise<TaxRate[]>;
  listAll(): Promise<TaxRate[]>;
  save(taxRate: TaxRate): Promise<void>;
  delete(id: UUID): Promise<void>;
}

export interface CategoryRepository {
  getById(id: UUID): Promise<Category | null>;
  list(): Promise<Category[]>;
  save(category: Category): Promise<void>;
  delete(id: UUID): Promise<void>;
}

export interface CustomFieldDefRepository {
  getById(id: UUID): Promise<CustomFieldDef | null>;
  listByEntity(entity: 'product' | 'customer' | 'sale'): Promise<CustomFieldDef[]>;
  listAll(): Promise<CustomFieldDef[]>;
  save(def: CustomFieldDef): Promise<void>;
  delete(id: UUID): Promise<void>;
}

export interface SaleRepository {
  getById(id: UUID): Promise<Sale | null>;
  getByNumber(saleNumber: string): Promise<Sale | null>;
  listByShift(shiftId: UUID): Promise<Sale[]>;
  save(sale: Sale): Promise<void>;
}

export interface ShiftRepository {
  getCurrentOpen(): Promise<Shift | null>;
  getById(id: UUID): Promise<Shift | null>;
  open(shift: Shift): Promise<void>;
  close(shift: Shift): Promise<void>;
}

export interface OutboxRepository {
  enqueue(item: OutboxItem): Promise<number>;
  listPending(limit?: number): Promise<OutboxItem[]>;
  countByStatus(status: OutboxStatus): Promise<number>;
  markStatus(seq: number, status: OutboxStatus, error?: string): Promise<void>;
}

export interface AuditRepository {
  log(entry: AuditEntry): Promise<void>;
  listRecent(limit?: number): Promise<AuditEntry[]>;
}

export interface MetaRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}
