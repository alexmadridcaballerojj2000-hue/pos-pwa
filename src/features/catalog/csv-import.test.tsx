import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { db } from '@/data/db';
import { CsvImportDialog } from './csv-import-dialog';
import type { Category, TaxRate } from '@/domain';

describe('CSV Bulk Product Import (S3-T4)', () => {
  const sampleCategories: Category[] = [
    {
      id: 'cat-bev',
      name: 'Bebidas',
      parentId: null,
      sort: 1,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  const sampleTaxRates: TaxRate[] = [
    {
      id: 'tax-16',
      name: 'IVA 16%',
      rateBp: 1600,
      active: true,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(async () => {
    await db.products.clear();
    await db.categories.clear();
    await db.taxRates.clear();
  });

  it('renders paste input, previews rows with errors and valid status, and filters', async () => {
    let importCompleted = false;

    render(
      <CsvImportDialog
        categories={sampleCategories}
        taxRates={sampleTaxRates}
        onImportComplete={async () => {
          importCompleted = true;
        }}
      />,
    );

    const textarea = screen.getByLabelText(/o pegar contenido csv directamente/i);
    const csvData =
      'sku,name,price,category\n' +
      'P-VALID-1,Galletas Avena,12.50,Snacks\n' +
      ',Sin SKU,20.00,Bebidas\n' +
      'P-VALID-2,Agua 1L,10.00,Bebidas';

    fireEvent.change(textarea, { target: { value: csvData } });

    // Verify summary banner
    expect(screen.getByText(/3 filas detectadas/i)).toBeInTheDocument();
    expect(screen.getByText('Válidos (2)')).toBeInTheDocument();
    expect(screen.getByText('Con Errores (1)')).toBeInTheDocument();

    // Verify table content
    expect(screen.getByText('Galletas Avena')).toBeInTheDocument();
    expect(screen.getByText('El SKU es obligatorio')).toBeInTheDocument();

    // Filter to only invalid
    fireEvent.click(screen.getByText('Con Errores (1)'));
    expect(screen.queryByText('Galletas Avena')).not.toBeInTheDocument();
    expect(screen.getByText('Sin SKU')).toBeInTheDocument();

    // Filter to only valid
    fireEvent.click(screen.getByText('Válidos (2)'));
    expect(screen.getByText('Galletas Avena')).toBeInTheDocument();
    expect(screen.getByText('Agua 1L')).toBeInTheDocument();

    // Execute import
    const importBtn = screen.getByRole('button', { name: /importar 2 válidos/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(importCompleted).toBe(true);
      expect(screen.getByText(/2 productos importados/i)).toBeInTheDocument();
    });

    // Check IndexedDB
    const savedProducts = await db.products.toArray();
    expect(savedProducts).toHaveLength(2);
    expect(savedProducts.some((p) => p.sku === 'P-VALID-1')).toBe(true);
    expect(savedProducts.some((p) => p.sku === 'P-VALID-2')).toBe(true);

    // Check auto-created category 'Snacks'
    const savedCategories = await db.categories.toArray();
    expect(savedCategories.some((c) => c.name === 'Snacks')).toBe(true);
  });

  it('benchmark: bulk importing 1 000 products completes in < 3 000 ms (SPEC §3.1)', async () => {
    let csv1000 = 'sku,name,price,cost,barcodes,category,tax_rate\r\n';
    for (let i = 1; i <= 1000; i++) {
      csv1000 += `SKU-${i},Producto de Prueba ${i},${(i * 1.5).toFixed(2)},${(i * 1.0).toFixed(2)},7501000${i},Categoria ${(i % 5) + 1},16\r\n`;
    }

    render(
      <CsvImportDialog
        categories={sampleCategories}
        taxRates={sampleTaxRates}
        onImportComplete={async () => {}}
      />,
    );

    const textarea = screen.getByLabelText(/o pegar contenido csv directamente/i);
    fireEvent.change(textarea, { target: { value: csv1000 } });

    const importBtn = await screen.findByRole('button', { name: /importar 1000 válidos/i });
    const start = performance.now();
    fireEvent.click(importBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/1000 productos importados/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(3000); // < 3 seconds requirement

    const count = await db.products.count();
    expect(count).toBe(1000);
  }, 10000);
});
