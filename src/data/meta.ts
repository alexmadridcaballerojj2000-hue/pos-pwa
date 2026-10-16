import { generateId, type UUID } from '@/domain';
import { type AppDatabase, db as defaultDb } from './db';

export const META_KEYS = {
  DEVICE_ID: 'deviceId',
  TENANT_ID: 'tenantId',
  STORE_ID: 'storeId',
  SERIES: 'series',
  SALE_SEQ: 'saleSeq',
  MODE: 'mode',
  SETUP_COMPLETED: 'setupCompleted',
  PULL_CURSOR: 'pullCursor',
  SERVER_OFFSET_MS: 'serverOffsetMs',
  SCHEMA_VERSION: 'schemaVersion',
} as const;

export async function getMeta<T>(
  db: AppDatabase,
  key: string,
  defaultValue: T | null = null,
): Promise<T | null> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : defaultValue;
}

export async function setMeta<T>(db: AppDatabase, key: string, value: T): Promise<void> {
  await db.meta.put({ key, value });
}

export interface DeviceMetaInit {
  deviceId?: UUID;
  series?: string;
  mode?: 'local' | 'synced';
  storeId?: UUID;
  tenantId?: UUID;
}

export async function initializeDeviceMeta(
  db: AppDatabase = defaultDb,
  options?: DeviceMetaInit,
): Promise<{ deviceId: UUID; series: string }> {
  return db.transaction('rw', db.meta, async () => {
    let deviceId = await getMeta<UUID>(db, META_KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = options?.deviceId ?? generateId();
      await setMeta(db, META_KEYS.DEVICE_ID, deviceId);
    }

    let series = await getMeta<string>(db, META_KEYS.SERIES);
    if (!series) {
      series = options?.series ?? 'L01';
      await setMeta(db, META_KEYS.SERIES, series);
    }

    const currentSeq = await getMeta<number>(db, META_KEYS.SALE_SEQ);
    if (currentSeq === null || currentSeq === undefined) {
      await setMeta(db, META_KEYS.SALE_SEQ, 0);
    }

    const mode = options?.mode ?? 'local';
    await setMeta(db, META_KEYS.MODE, mode);
    await setMeta(db, META_KEYS.SCHEMA_VERSION, 1);

    if (options?.storeId) {
      await setMeta(db, META_KEYS.STORE_ID, options.storeId);
    }
    if (options?.tenantId) {
      await setMeta(db, META_KEYS.TENANT_ID, options.tenantId);
    }

    return { deviceId, series };
  });
}

export interface NextSaleNumberResult {
  number: string;
  seq: number;
  series: string;
}

/**
 * Atomically increments the sale sequence and generates the next formatted sale number.
 * Concurrency safe: Dexie serializes write transactions on the meta table, ensuring
 * that simultaneous calls never read or produce duplicate sequence numbers.
 */
export async function getNextSaleNumber(
  db: AppDatabase = defaultDb,
  seriesOverride?: string,
): Promise<NextSaleNumberResult> {
  return db.transaction('rw', db.meta, async () => {
    const series = seriesOverride ?? (await getMeta<string>(db, META_KEYS.SERIES)) ?? 'L01';

    const currentSeq = (await getMeta<number>(db, META_KEYS.SALE_SEQ)) ?? 0;
    const nextSeq = currentSeq + 1;

    await setMeta(db, META_KEYS.SALE_SEQ, nextSeq);

    const formattedNumber = `${series}-${String(nextSeq).padStart(6, '0')}`;

    return {
      number: formattedNumber,
      seq: nextSeq,
      series,
    };
  });
}
