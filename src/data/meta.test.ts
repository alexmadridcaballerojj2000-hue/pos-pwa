import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from './db';
import { getMeta, getNextSaleNumber, initializeDeviceMeta, META_KEYS } from './meta';
import { isUuidV7 } from '@/domain';

describe('Meta & Atomic Sale Numbering (SPEC §6.4)', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createAppDatabase(`test_meta_${Date.now()}_${Math.random()}`);
  });

  it('initializes device meta with UUIDv7 deviceId, series L01 and saleSeq 0', async () => {
    const init = await initializeDeviceMeta(db);

    expect(isUuidV7(init.deviceId)).toBe(true);
    expect(init.series).toBe('L01');

    const storedDeviceId = await getMeta<string>(db, META_KEYS.DEVICE_ID);
    const storedSeries = await getMeta<string>(db, META_KEYS.SERIES);
    const storedSeq = await getMeta<number>(db, META_KEYS.SALE_SEQ);
    const storedMode = await getMeta<string>(db, META_KEYS.MODE);

    expect(storedDeviceId).toBe(init.deviceId);
    expect(storedSeries).toBe('L01');
    expect(storedSeq).toBe(0);
    expect(storedMode).toBe('local');
  });

  it('increments sequence and formats sale numbers correctly', async () => {
    await initializeDeviceMeta(db, { series: 'L01' });

    const first = await getNextSaleNumber(db);
    expect(first.number).toBe('L01-000001');
    expect(first.seq).toBe(1);

    const second = await getNextSaleNumber(db);
    expect(second.number).toBe('L01-000002');
    expect(second.seq).toBe(2);

    const customSeries = await getNextSaleNumber(db, 'A02');
    expect(customSeries.number).toBe('A02-000003');
    expect(customSeries.seq).toBe(3);
  });

  it('CONCURRENCY GUARANTEE: 50 simultaneous calls never repeat numbers and have zero gaps', async () => {
    await initializeDeviceMeta(db, { series: 'L01' });

    // Fire 50 concurrent invocations without awaiting between them
    const promises = Array.from({ length: 50 }, () => getNextSaleNumber(db));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(50);

    // Verify all 50 sale numbers are strictly unique
    const uniqueNumbers = new Set(results.map((r) => r.number));
    expect(uniqueNumbers.size).toBe(50);

    // Verify all sequence numbers from 1 to 50 are present
    const sequences = results.map((r) => r.seq).sort((a, b) => a - b);
    for (let i = 0; i < 50; i++) {
      expect(sequences[i]).toBe(i + 1);
    }

    // Verify persisted saleSeq is exactly 50
    const finalStoredSeq = await getMeta<number>(db, META_KEYS.SALE_SEQ);
    expect(finalStoredSeq).toBe(50);
  });
});
