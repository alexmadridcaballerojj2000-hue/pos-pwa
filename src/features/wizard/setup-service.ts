import { generateId, hashPin, type Settings, type TaxRate, type User, type UUID } from '@/domain';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { initializeDeviceMeta, META_KEYS, setMeta } from '@/data/meta';

export interface SetupFormData {
  businessName: string;
  taxId?: string;
  address?: string;
  phone?: string;
  receiptFooter?: string;
  currencyCode: string;
  currencySymbol: string;
  decimals: number;
  pricesIncludeTax: boolean;
  taxName: string;
  taxPercent: number;
  ownerName: string;
  ownerPin: string;
}

export interface SetupResult {
  deviceId: UUID;
  ownerId: UUID;
  taxRateId: UUID;
}

export async function completeSetup(
  data: SetupFormData,
  db: AppDatabase = defaultDb,
): Promise<SetupResult> {
  const nowIso = new Date().toISOString();

  // 1. Initialize device meta
  const { deviceId } = await initializeDeviceMeta(db, { mode: 'local', series: 'L01' });

  // 2. Hash owner PIN with WebCrypto PBKDF2
  const hashedPin = await hashPin(data.ownerPin);
  const ownerId = generateId();

  const ownerUser: User = {
    id: ownerId,
    name: data.ownerName.trim(),
    role: 'owner',
    active: true,
    pin: hashedPin,
    version: 1,
    updatedAt: nowIso,
  };

  // 3. Create default tax rate
  const taxRateId = generateId();
  const taxRate: TaxRate = {
    id: taxRateId,
    name: data.taxName.trim(),
    rateBp: Math.round(data.taxPercent * 100),
    active: true,
    version: 1,
    updatedAt: nowIso,
  };

  // 4. Create singleton settings
  const settings: Settings = {
    id: 'singleton',
    business: {
      name: data.businessName.trim(),
      taxId: data.taxId?.trim() || undefined,
      address: data.address?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      footerText: data.receiptFooter?.trim() || undefined,
    },
    currency: {
      code: data.currencyCode.trim().toUpperCase(),
      decimals: data.decimals,
      symbol: data.currencySymbol.trim(),
    },
    pricesIncludeTax: data.pricesIncludeTax,
    requireShift: true,
    allowNegativeStock: true,
    maxDiscountBp: 1000,
    paymentMethods: [
      { id: 'cash', label: 'Efectivo', kind: 'cash', active: true, requireReference: false },
      { id: 'card', label: 'Tarjeta', kind: 'card', active: true, requireReference: true },
      {
        id: 'transfer',
        label: 'Transferencia',
        kind: 'transfer',
        active: true,
        requireReference: true,
      },
    ],
    modules: {},
    receipt: { paperWidthMm: 80, template: {} },
    mode: 'local',
  };

  // Persist all in a Dexie transaction
  await db.transaction(
    'rw',
    [db.settings, db.taxRates, db.users, db.meta, db.auditLog],
    async () => {
      await db.settings.put(settings);
      await db.taxRates.put(taxRate);
      await db.users.put(ownerUser);
      await setMeta(db, META_KEYS.SETUP_COMPLETED, true);

      await db.auditLog.add({
        id: generateId(),
        ts: nowIso,
        userId: ownerId,
        action: 'setup:complete',
        entity: 'system',
        details: {
          businessName: data.businessName,
          currency: data.currencyCode,
          pricesIncludeTax: data.pricesIncludeTax,
        },
      });
    },
  );

  return { deviceId, ownerId, taxRateId };
}
