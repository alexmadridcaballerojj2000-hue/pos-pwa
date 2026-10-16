import 'fake-indexeddb/auto';
import { performance } from 'node:perf_hooks';
import { generateProductData } from './seed';
import { parseCsvWithHeader, validateProductCsvRows, type Product } from '../src/domain';
import { ProductSearchIndex } from '../src/features/catalog/search-index';
import { createAppDatabase } from '../src/data/db';

async function runBenchmarks() {
  console.log('='.repeat(65));
  console.log('  POS-PWA — Benchmark de Rendimiento (Sprint S3: Catálogo)');
  console.log('='.repeat(65));

  // 1. Generate 10k test products
  console.log('\n[1/4] Generando 10,000 productos en memoria...');
  const t0 = performance.now();
  const rawCsv10k = generateProductData(10000);
  const { rows } = parseCsvWithHeader(rawCsv10k);
  const validations = validateProductCsvRows(rows);
  const validProducts: Product[] = validations.map((v, idx) => ({
    id: `prod_${idx + 1}`,
    sku: v.product!.sku,
    name: v.product!.name,
    barcodes: v.product!.barcodes,
    categoryId: 'cat_test',
    taxRateId: 'tax_test',
    priceMinor: v.product!.priceMinor,
    costMinor: v.product!.costMinor,
    trackStock: true,
    unit: v.product!.unit,
    allowFractional: v.product!.allowFractional,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  }));
  const genTime = performance.now() - t0;
  console.log(`✓ 10,000 productos generados y validados en ${genTime.toFixed(1)} ms`);

  // 2. MiniSearch Indexing benchmark
  console.log('\n[2/4] Indexando 10,000 productos en MiniSearch...');
  const searchIndex = new ProductSearchIndex();
  const tIndexStart = performance.now();
  searchIndex.indexAll(validProducts);
  const indexDuration = performance.now() - tIndexStart;
  console.log(
    `✓ Indexación de 10,000 productos: ${indexDuration.toFixed(1)} ms (esperado < 1000 ms)`,
  );

  // 3. MiniSearch Search Latency Benchmark (SPEC §3.1: < 50ms)
  console.log('\n[3/4] Evaluando latencia de búsqueda en catálogo de 10,000 productos...');
  const testQueries = [
    'Galletas',
    'Refresco 355ml',
    '750000000050',
    'PROD-00042',
    'Leche Deslactosada',
    'Detergente Concentrado',
    'Chocolate Artesanal',
    'Yogurt Natural',
    '750000009999',
    'PROD-09999',
    'Limpiador Familiar',
    'Papel Higiénico',
    'Café Gourmet',
    'Atún Extra',
    'Queso',
  ];

  const searchDurations: number[] = [];

  // Warmup + 50 queries
  for (let round = 0; round < 4; round++) {
    for (const q of testQueries) {
      const qStart = performance.now();
      const results = searchIndex.search(q, { limit: 50 });
      const qDuration = performance.now() - qStart;
      searchDurations.push(qDuration);
      if (results.length === 0) {
        console.warn(`Aviso: query "${q}" retornó 0 resultados`);
      }
    }
  }

  searchDurations.sort((a, b) => a - b);
  const p50 = searchDurations[Math.floor(searchDurations.length * 0.5)]!;
  const p95 = searchDurations[Math.floor(searchDurations.length * 0.95)]!;
  const p99 = searchDurations[Math.floor(searchDurations.length * 0.99)]!;
  const max = searchDurations[searchDurations.length - 1]!;

  console.log(`✓ Búsquedas ejecutadas: ${searchDurations.length}`);
  console.log(`  - p50: ${p50.toFixed(2)} ms`);
  console.log(`  - p95: ${p95.toFixed(2)} ms`);
  console.log(`  - p99: ${p99.toFixed(2)} ms`);
  console.log(`  - Max: ${max.toFixed(2)} ms`);

  if (p95 >= 50) {
    throw new Error(`CRITERIO FALLIDO: p95 (${p95.toFixed(2)}ms) supera el umbral de 50ms`);
  }
  console.log('✓ Criterio SPEC cumplido: Búsqueda sobre 10,000 productos estrictamente < 50 ms!');

  // 4. CSV Import Bulk Insert Benchmark (SPEC §3.1: 1 000 filas en < 3s)
  console.log('\n[4/4] Evaluando importación e inserción por lotes en Dexie (1,000 productos)...');
  const db = createAppDatabase(`benchmark_db_${Date.now()}`);
  const productsToInsert = validProducts.slice(0, 1000);

  const tBulkStart = performance.now();
  await db.products.bulkPut(productsToInsert);
  const bulkDuration = performance.now() - tBulkStart;

  const countInDb = await db.products.count();
  console.log(
    `✓ Inserción de 1,000 registros en Dexie: ${bulkDuration.toFixed(1)} ms (${countInDb} registros)`,
  );

  if (bulkDuration >= 3000) {
    throw new Error(
      `CRITERIO FALLIDO: Importación de 1,000 filas (${bulkDuration.toFixed(1)}ms) supera 3,000 ms`,
    );
  }
  console.log('✓ Criterio SPEC cumplido: Inserción de 1,000 filas en < 3 s!');

  console.log('\n' + '='.repeat(65));
  console.log('  TODOS LOS CRITERIOS DE RENDIMIENTO DEL SPEC APROBADOS (PASS)');
  console.log('='.repeat(65) + '\n');
}

runBenchmarks().catch((err) => {
  console.error('\n❌ Error en benchmark:', err);
  process.exit(1);
});
