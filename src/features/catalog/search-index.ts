import MiniSearch from 'minisearch';
import type { Product } from '@/domain';

export interface IndexedProductDoc {
  id: string;
  sku: string;
  name: string;
  barcodes: string;
  categoryId: string | null;
  active: boolean;
  priceMinor: number;
}

export interface ProductSearchOptions {
  categoryId?: string | null;
  activeOnly?: boolean;
  limit?: number;
}

export class ProductSearchIndex {
  private miniSearch: MiniSearch<IndexedProductDoc>;
  private productsById: Map<string, Product> = new Map();
  private barcodeMap: Map<string, string> = new Map(); // barcode -> productId for instant scanner O(1)

  constructor() {
    this.miniSearch = new MiniSearch<IndexedProductDoc>({
      fields: ['name', 'sku', 'barcodes'],
      storeFields: ['id', 'sku', 'name', 'categoryId', 'active', 'priceMinor'],
      searchOptions: {
        prefix: true,
        fuzzy: (term) => (term.length > 3 ? 0.2 : 0),
        boost: { sku: 3, barcodes: 2.5, name: 1 },
      },
    });
  }

  private toDoc(product: Product): IndexedProductDoc {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      barcodes: product.barcodes ? product.barcodes.join(' ') : '',
      categoryId: product.categoryId ?? null,
      active: product.active,
      priceMinor: product.priceMinor,
    };
  }

  public get size(): number {
    return this.productsById.size;
  }

  public indexAll(products: Product[]): void {
    this.productsById.clear();
    this.barcodeMap.clear();
    this.miniSearch.removeAll();

    const docs: IndexedProductDoc[] = new Array(products.length);

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p) continue;
      this.productsById.set(p.id, p);

      if (p.barcodes) {
        for (const b of p.barcodes) {
          this.barcodeMap.set(b.trim(), p.id);
        }
      }

      docs[i] = this.toDoc(p);
    }

    this.miniSearch.addAll(docs);
  }

  public addOrUpdate(product: Product): void {
    this.productsById.set(product.id, product);

    // Update barcode mappings
    if (product.barcodes) {
      for (const b of product.barcodes) {
        this.barcodeMap.set(b.trim(), product.id);
      }
    }

    const doc = this.toDoc(product);
    if (this.miniSearch.has(product.id)) {
      this.miniSearch.replace(doc);
    } else {
      this.miniSearch.add(doc);
    }
  }

  public remove(id: string): void {
    const existing = this.productsById.get(id);
    if (existing?.barcodes) {
      for (const b of existing.barcodes) {
        this.barcodeMap.delete(b.trim());
      }
    }

    this.productsById.delete(id);
    if (this.miniSearch.has(id)) {
      this.miniSearch.discard(id);
    }
  }

  public search(query: string, options?: ProductSearchOptions): Product[] {
    const trimmed = query.trim();

    // Empty query: return all with filters
    if (!trimmed) {
      let list = Array.from(this.productsById.values());
      if (options?.categoryId) {
        list = list.filter((p) => p.categoryId === options.categoryId);
      }
      if (options?.activeOnly) {
        list = list.filter((p) => p.active);
      }
      return options?.limit ? list.slice(0, options.limit) : list;
    }

    // 1. Instant O(1) Barcode check (critical for POS barcode gun scan)
    const exactBarcodeMatchId = this.barcodeMap.get(trimmed);
    const results: Product[] = [];
    const seenIds = new Set<string>();

    if (exactBarcodeMatchId) {
      const p = this.productsById.get(exactBarcodeMatchId);
      if (p) {
        const matchesCategory = !options?.categoryId || p.categoryId === options.categoryId;
        const matchesActive = !options?.activeOnly || p.active;
        if (matchesCategory && matchesActive) {
          results.push(p);
          seenIds.add(p.id);
        }
      }
    }

    // 2. Full-text search with prefix and fuzzy matching
    const searchResults = this.miniSearch.search(trimmed, {
      prefix: true,
      fuzzy: trimmed.length > 3 ? 0.2 : 0,
      filter: (result) => {
        if (options?.categoryId && result.categoryId !== options.categoryId) {
          return false;
        }
        if (options?.activeOnly && !result.active) {
          return false;
        }
        return true;
      },
    });

    const limit = options?.limit ?? 50;

    for (const r of searchResults) {
      if (!seenIds.has(r.id)) {
        const p = this.productsById.get(r.id);
        if (p) {
          results.push(p);
          seenIds.add(p.id);
          if (results.length >= limit) break;
        }
      }
    }

    return results;
  }
}

export const productSearchIndex = new ProductSearchIndex();
