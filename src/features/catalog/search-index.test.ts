import { beforeEach, describe, expect, it } from 'vitest';
import { ProductSearchIndex } from './search-index';
import type { Product } from '@/domain';

describe('ProductSearchIndex with MiniSearch (S3-T5)', () => {
  let searchIndex: ProductSearchIndex;

  const sampleProducts: Product[] = [
    {
      id: 'p1',
      sku: 'COCA-500',
      name: 'Coca Cola 500ml Original',
      barcodes: ['7501055300075', '111222333'],
      categoryId: 'cat-soda',
      taxRateId: 'tax-16',
      priceMinor: 1800,
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p2',
      sku: 'PEPSI-500',
      name: 'Pepsi Cola 500ml',
      barcodes: ['7501055399999'],
      categoryId: 'cat-soda',
      taxRateId: 'tax-16',
      priceMinor: 1700,
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p3',
      sku: 'WATER-1L',
      name: 'Agua Mineral Manantial 1L',
      barcodes: ['7501000000001'],
      categoryId: 'cat-water',
      taxRateId: 'tax-0',
      priceMinor: 1200,
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: false, // inactive
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    searchIndex = new ProductSearchIndex();
    searchIndex.indexAll(sampleProducts);
  });

  it('finds products by exact barcode instantly', () => {
    const results = searchIndex.search('7501055300075');
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('p1');

    // Secondary barcode on the same product
    const secondaryResults = searchIndex.search('111222333');
    expect(secondaryResults).toHaveLength(1);
    expect(secondaryResults[0]?.id).toBe('p1');
  });

  it('finds products by SKU and prefix', () => {
    const bySku = searchIndex.search('COCA');
    expect(bySku.length).toBeGreaterThanOrEqual(1);
    expect(bySku[0]?.sku).toBe('COCA-500');

    const byPrefix = searchIndex.search('Pep');
    expect(byPrefix).toHaveLength(1);
    expect(byPrefix[0]?.sku).toBe('PEPSI-500');
  });

  it('finds products with typo using fuzzy matching', () => {
    // "Manantial" typed as "Manantiel"
    const results = searchIndex.search('Manantiel');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.id).toBe('p3');
  });

  it('filters results by category and active status', () => {
    // Category filter
    const sodaOnly = searchIndex.search('500ml', { categoryId: 'cat-soda' });
    expect(sodaOnly).toHaveLength(2);

    const waterOnly = searchIndex.search('1L', { categoryId: 'cat-water' });
    expect(waterOnly).toHaveLength(1);

    // Active only filter (Water is inactive)
    const activeResults = searchIndex.search('Agua', { activeOnly: true });
    expect(activeResults).toHaveLength(0);

    const allResults = searchIndex.search('Agua', { activeOnly: false });
    expect(allResults).toHaveLength(1);
  });

  it('supports reactive addOrUpdate and remove', () => {
    const newProduct: Product = {
      id: 'p4',
      sku: 'CHIPS-LAYS',
      name: 'Papas Fritas Clásicas',
      barcodes: ['750999888111'],
      categoryId: 'cat-snacks',
      taxRateId: 'tax-16',
      priceMinor: 2200,
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    searchIndex.addOrUpdate(newProduct);
    expect(searchIndex.size).toBe(4);
    expect(searchIndex.search('Papas')).toHaveLength(1);
    expect(searchIndex.search('750999888111')).toHaveLength(1);

    // Remove
    searchIndex.remove('p4');
    expect(searchIndex.size).toBe(3);
    expect(searchIndex.search('Papas')).toHaveLength(0);
    expect(searchIndex.search('750999888111')).toHaveLength(0);
  });

  it('benchmark: search on 10 000 products executes in < 50 ms (SPEC §3.1)', () => {
    const largeCatalog: Product[] = new Array(10000);
    const nowIso = new Date().toISOString();

    for (let i = 0; i < 10000; i++) {
      largeCatalog[i] = {
        id: `prod_${i}`,
        sku: `SKU-${i}`,
        name: `Producto de Consumo ${i} Variedad Bebida ${(i % 100) + 1}`,
        barcodes: [`75010000${i}`],
        categoryId: `cat_${i % 10}`,
        taxRateId: 'tax-16',
        priceMinor: (i + 1) * 100,
        trackStock: true,
        unit: 'unit',
        allowFractional: false,
        active: i % 20 !== 0,
        custom: {},
        version: 1,
        updatedAt: nowIso,
      };
    }

    const largeIndex = new ProductSearchIndex();
    largeIndex.indexAll(largeCatalog);
    expect(largeIndex.size).toBe(10000);

    // Benchmark search execution times
    const queries = ['Bebida 50', 'SKU-999', '750100005000', 'Consumo 250', 'Prod'];

    for (const q of queries) {
      const start = performance.now();
      const results = largeIndex.search(q, { limit: 50 });
      const durationMs = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(50); // Must be strictly < 50ms per SPEC
    }
  });
});
