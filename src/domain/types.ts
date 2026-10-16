import type { Bp, ISODate, Milli, Minor, UUID } from './index';

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

export type PaymentMethodKind = 'cash' | 'card' | 'transfer' | 'other';

export interface PaymentMethodConfig {
  id: string;
  label: string;
  kind: PaymentMethodKind;
  active: boolean;
  requireReference: boolean;
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

export interface SaleLineDiscount {
  type: 'percent' | 'fixed';
  value: number;
  reason?: string;
  approvedBy?: UUID;
}

export interface SaleLine {
  lineId: UUID;
  productId: UUID;
  sku: string;
  name: string;
  qty: Milli;
  unitPrice: Minor;
  discount?: SaleLineDiscount;
  taxRateId: UUID;
  taxRateBp: Bp;
  lineBase: Minor;
  lineDiscount: Minor;
  orderDiscountShare: Minor;
  taxableBase: Minor;
  tax: Minor;
  lineTotal: Minor;
  note?: string;
  custom: Record<string, unknown>;
}

export interface SalePayment {
  id: UUID;
  method: string;
  amount: Minor;
  tendered?: Minor;
  reference?: string;
  createdAt: ISODate;
}

export interface TaxBreakdownItem {
  taxRateId: UUID;
  rateBp: Bp;
  base: Minor;
  tax: Minor;
}

export interface SaleTotals {
  subtotal: Minor;
  lineDiscounts: Minor;
  orderDiscount: Minor;
  tax: Minor;
  roundingAdjustment: Minor;
  total: Minor;
  taxBreakdown: TaxBreakdownItem[];
}

export interface SaleOrderDiscount {
  type: 'percent' | 'fixed';
  value: number;
  reason?: string;
  approvedBy?: UUID;
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
  payments: SalePayment[];
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
  refunds: SalePayment[];
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
