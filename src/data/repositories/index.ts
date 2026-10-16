import type {
  AuditEntry,
  AuditRepository,
  Category,
  CategoryRepository,
  CustomFieldDef,
  CustomFieldDefRepository,
  Customer,
  CustomerRepository,
  MetaRepository,
  OutboxItem,
  OutboxRepository,
  OutboxStatus,
  Product,
  ProductRepository,
  Sale,
  SaleRepository,
  Settings,
  SettingsRepository,
  Shift,
  ShiftRepository,
  TaxRate,
  TaxRateRepository,
  User,
  UserRepository,
  UUID,
} from '@/domain';
import { type AppDatabase, db as defaultDb } from '../db';

export class DexieUserRepository implements UserRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getById(id: UUID): Promise<User | null> {
    const user = await this.db.users.get(id);
    return user ?? null;
  }

  async listActive(): Promise<User[]> {
    return this.db.users.filter((u) => u.active).toArray();
  }

  async create(user: User): Promise<void> {
    await this.db.users.add(user);
  }

  async update(user: User): Promise<void> {
    await this.db.users.put(user);
  }
}

export class DexieSettingsRepository implements SettingsRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async get(): Promise<Settings | null> {
    const settings = await this.db.settings.get('singleton');
    return settings ?? null;
  }

  async save(settings: Settings): Promise<void> {
    await this.db.settings.put(settings);
  }
}

export class DexieProductRepository implements ProductRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getById(id: UUID): Promise<Product | null> {
    const product = await this.db.products.get(id);
    return product ?? null;
  }

  async getByBarcode(barcode: string): Promise<Product | null> {
    const product = await this.db.products.where('barcodes').equals(barcode).first();
    return product ?? null;
  }

  async getBySku(sku: string): Promise<Product | null> {
    const product = await this.db.products.where('sku').equals(sku).first();
    return product ?? null;
  }

  async list(filter?: import('@/domain').ProductFilter): Promise<Product[]> {
    let collection = this.db.products.toCollection();

    if (filter?.categoryId) {
      collection = this.db.products.where('categoryId').equals(filter.categoryId);
    }

    let products = await collection.toArray();

    if (filter?.activeOnly) {
      products = products.filter((p) => p.active);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcodes.some((b) => b.includes(q)),
      );
    }

    return products;
  }

  async listActive(): Promise<Product[]> {
    return this.db.products.filter((p) => p.active).toArray();
  }

  async save(product: Product): Promise<void> {
    await this.db.products.put(product);
  }

  async delete(id: UUID): Promise<void> {
    await this.db.products.delete(id);
  }
}

export class DexieTaxRateRepository implements TaxRateRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getById(id: UUID): Promise<TaxRate | null> {
    const rate = await this.db.taxRates.get(id);
    return rate ?? null;
  }

  async listActive(): Promise<TaxRate[]> {
    return this.db.taxRates.filter((t) => t.active).toArray();
  }

  async listAll(): Promise<TaxRate[]> {
    return this.db.taxRates.toArray();
  }

  async save(taxRate: TaxRate): Promise<void> {
    await this.db.taxRates.put(taxRate);
  }

  async delete(id: UUID): Promise<void> {
    await this.db.taxRates.delete(id);
  }
}

export class DexieCategoryRepository implements CategoryRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getById(id: UUID): Promise<Category | null> {
    const category = await this.db.categories.get(id);
    return category ?? null;
  }

  async list(): Promise<Category[]> {
    return this.db.categories.orderBy('sort').toArray();
  }

  async save(category: Category): Promise<void> {
    await this.db.categories.put(category);
  }

  async delete(id: UUID): Promise<void> {
    await this.db.categories.delete(id);
  }
}

export class DexieCustomFieldDefRepository implements CustomFieldDefRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getById(id: UUID): Promise<CustomFieldDef | null> {
    const def = await this.db.customFieldDefs.get(id);
    return def ?? null;
  }

  async listByEntity(entity: 'product' | 'customer' | 'sale'): Promise<CustomFieldDef[]> {
    return this.db.customFieldDefs.where('entity').equals(entity).toArray();
  }

  async listAll(): Promise<CustomFieldDef[]> {
    return this.db.customFieldDefs.toArray();
  }

  async save(def: CustomFieldDef): Promise<void> {
    await this.db.customFieldDefs.put(def);
  }

  async delete(id: UUID): Promise<void> {
    await this.db.customFieldDefs.delete(id);
  }
}

export class DexieCustomerRepository implements CustomerRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getById(id: UUID): Promise<Customer | null> {
    const customer = await this.db.customers.get(id);
    return customer ?? null;
  }

  async search(query: string): Promise<Customer[]> {
    const q = query.toLowerCase().trim();
    if (!q) {
      return this.list(50);
    }
    return this.db.customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          Boolean(c.phone && c.phone.includes(q)) ||
          Boolean(c.taxId && c.taxId.toLowerCase().includes(q)) ||
          Boolean(c.email && c.email.toLowerCase().includes(q)),
      )
      .limit(50)
      .toArray();
  }

  async list(limit = 100): Promise<Customer[]> {
    return this.db.customers.orderBy('name').limit(limit).toArray();
  }

  async save(customer: Customer): Promise<void> {
    await this.db.customers.put(customer);
  }

  async delete(id: UUID): Promise<void> {
    await this.db.customers.delete(id);
  }
}

export class DexieSaleRepository implements SaleRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getById(id: UUID): Promise<Sale | null> {
    const sale = await this.db.sales.get(id);
    return sale ?? null;
  }

  async getByNumber(saleNumber: string): Promise<Sale | null> {
    const sale = await this.db.sales.where('number').equals(saleNumber).first();
    return sale ?? null;
  }

  async listByShift(shiftId: UUID): Promise<Sale[]> {
    return this.db.sales.where('shiftId').equals(shiftId).toArray();
  }

  async save(sale: Sale): Promise<void> {
    await this.db.sales.put(sale);
  }
}

export class DexieShiftRepository implements ShiftRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async getCurrentOpen(): Promise<Shift | null> {
    const shift = await this.db.shifts.where('status').equals('open').first();
    return shift ?? null;
  }

  async getById(id: UUID): Promise<Shift | null> {
    const shift = await this.db.shifts.get(id);
    return shift ?? null;
  }

  async open(shift: Shift): Promise<void> {
    await this.db.shifts.add(shift);
  }

  async close(shift: Shift): Promise<void> {
    await this.db.shifts.put(shift);
  }
}

export class DexieOutboxRepository implements OutboxRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async enqueue(item: OutboxItem): Promise<number> {
    const seq = await this.db.outbox.add(item);
    return seq;
  }

  async listPending(limit = 100): Promise<OutboxItem[]> {
    return this.db.outbox.where('status').equals('pending').limit(limit).toArray();
  }

  async countByStatus(status: OutboxStatus): Promise<number> {
    return this.db.outbox.where('status').equals(status).count();
  }

  async markStatus(seq: number, status: OutboxStatus, error?: string): Promise<void> {
    await this.db.outbox.update(seq, {
      status,
      ...(error ? { lastError: error } : {}),
    });
  }
}

export class DexieAuditRepository implements AuditRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.add(entry);
  }

  async listRecent(limit = 50): Promise<AuditEntry[]> {
    return this.db.auditLog.orderBy('ts').reverse().limit(limit).toArray();
  }
}

export class DexieMetaRepository implements MetaRepository {
  constructor(private readonly db: AppDatabase = defaultDb) {}

  async get<T>(key: string): Promise<T | null> {
    const row = await this.db.meta.get(key);
    return row ? (row.value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.db.meta.put({ key, value });
  }
}

export interface Repositories {
  users: UserRepository;
  settings: SettingsRepository;
  products: ProductRepository;
  customers: CustomerRepository;
  taxRates: TaxRateRepository;
  categories: CategoryRepository;
  customFieldDefs: CustomFieldDefRepository;
  sales: SaleRepository;
  shifts: ShiftRepository;
  outbox: OutboxRepository;
  audit: AuditRepository;
  meta: MetaRepository;
}

export function createRepositories(db: AppDatabase = defaultDb): Repositories {
  return {
    users: new DexieUserRepository(db),
    settings: new DexieSettingsRepository(db),
    products: new DexieProductRepository(db),
    customers: new DexieCustomerRepository(db),
    taxRates: new DexieTaxRateRepository(db),
    categories: new DexieCategoryRepository(db),
    customFieldDefs: new DexieCustomFieldDefRepository(db),
    sales: new DexieSaleRepository(db),
    shifts: new DexieShiftRepository(db),
    outbox: new DexieOutboxRepository(db),
    audit: new DexieAuditRepository(db),
    meta: new DexieMetaRepository(db),
  };
}

export const repositories = createRepositories();
