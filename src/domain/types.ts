import type { Bp, ISODate, Milli, Minor, UUID } from './index';
import type { SaleLine, SaleTotals } from './calculator';
import type { Payment, PaymentMethodConfig } from './payments';
import type { Discount } from './discount';

export type { UUID };
export type SaleOrderDiscount = Discount;

export interface Versioned {
  id: UUID;
  version: number;
  updatedAt: ISODate;
  deletedAt?: ISODate | null;
}

export interface TaxRate extends Versioned {
  name: string;
  rateBp: Bp;
  active: boolean;
}

export interface Category extends Versioned {
  name: string;
  parentId?: UUID | null;
  sort: number;
}

export type ProductUnit = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'm';

export interface Product extends Versioned {
  sku: string;
  barcodes: string[];
  name: string;
  categoryId?: UUID | null;
  priceMinor: Minor;
  costMinor?: Minor;
  taxRateId: UUID;
  trackStock: boolean;
  minStockMilli?: Milli;
  unit: ProductUnit;
  allowFractional: boolean;
  active: boolean;
  custom: Record<string, unknown>;
}

export interface Customer extends Versioned {
  name: string;
  phone?: string;
  email?: string;
  taxId?: string;
  address?: string;
  custom: Record<string, unknown>;
}

export type UserRole = 'cashier' | 'manager' | 'owner';

export interface UserPin {
  hash: string;
  salt: string;
  iterations: number;
}

export interface User extends Versioned {
  name: string;
  role: UserRole;
  active: boolean;
  pin: UserPin;
}

export interface Settings {
  id: 'singleton';
  business: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    footerText?: string;
  };
  currency: {
    code: string;
    decimals: number;
    symbol: string;
  };
  pricesIncludeTax: boolean;
  requireShift: boolean; // def: true
  allowNegativeStock: boolean; // def: true
  maxDiscountBp: Bp; // def: 1000
  paymentMethods: PaymentMethodConfig[];
  modules: Record<string, boolean>;
  receipt: {
    paperWidthMm: 58 | 80;
    template: unknown;
  };
  mode: 'local' | 'synced';
}

export interface CustomFieldDef extends Versioned {
  entity: 'product' | 'customer' | 'sale';
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'bool' | 'date';
  options?: string[];
  required: boolean;
  showOn: ('form' | 'pos' | 'receipt')[];
}

export interface Sale {
  id: UUID;
  number: string;
  deviceId: UUID;
  shiftId: UUID | null;
  cashierId: UUID;
  customerId?: UUID | null;
  status: 'completed';
  lines: SaleLine[];
  orderDiscount?: SaleOrderDiscount;
  totals: SaleTotals;
  payments: Payment[];
  change: Minor;
  pricesIncludeTax: boolean;
  currency: string;
  notes?: string;
  custom: Record<string, unknown>;
  fiscal?: {
    number?: string;
    authorization?: string;
  } | null;
  createdAt: ISODate;
  completedAt: ISODate;
  schemaVersion: 1;
}

export interface SaleVoid {
  id: UUID;
  saleId: UUID;
  shiftId: UUID | null;
  reason: string;
  approvedBy: UUID;
  createdBy: UUID;
  createdAt: ISODate;
}

export interface SaleReturn {
  id: UUID;
  saleId: UUID;
  shiftId: UUID | null;
  lines: {
    lineId: UUID;
    qty: Milli;
    refund: Minor;
  }[];
  refunds: Payment[];
  reason: string;
  approvedBy?: UUID;
  createdBy: UUID;
  createdAt: ISODate;
}

export interface Shift {
  id: UUID;
  deviceId: UUID;
  openedBy: UUID;
  openedAt: ISODate;
  openingFloat: Minor;
  status: 'open' | 'closed';
  closedBy?: UUID;
  closedAt?: ISODate;
  countedCash?: Minor;
  expectedCash?: Minor;
  difference?: Minor;
}

export interface CashMovement {
  id: UUID;
  shiftId: UUID;
  type: 'in' | 'out';
  amount: Minor;
  reason: string;
  createdBy: UUID;
  createdAt: ISODate;
}

export type InventoryMovementType =
  'sale' | 'void' | 'return' | 'adjustment' | 'initial' | 'purchase';

export interface InventoryMovement {
  id: UUID;
  productId: UUID;
  qty: Milli; // + entra, - sale
  type: InventoryMovementType;
  refType?: 'sale' | 'sale_void' | 'sale_return';
  refId?: UUID;
  reason?: string;
  createdBy: UUID;
  createdAt: ISODate;
}

export interface AuditEntry {
  id: UUID;
  ts: ISODate;
  userId: UUID;
  action: string;
  entity: string;
  entityId?: UUID;
  details?: Record<string, unknown>;
}

export interface HeldCart {
  id: UUID;
  cashierId: UUID;
  label?: string;
  lines: unknown[];
  customerId?: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface StockLevel {
  productId: UUID;
  qty: Milli;
}

export type OutboxOp = 'create' | 'upsert';
export type OutboxStatus = 'pending' | 'sending' | 'synced' | 'dead';

export interface OutboxItem {
  seq?: number;
  eventId: UUID;
  entity: string;
  entityId: UUID;
  op: OutboxOp;
  payload: unknown;
  schemaVersion: number;
  occurredAt: ISODate;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
