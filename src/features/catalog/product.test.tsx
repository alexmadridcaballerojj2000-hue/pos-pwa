import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { DexieProductRepository } from '@/data/repositories';
import { ProductDialog } from './product-dialog';
import { ProductList } from './product-list';
import type { Category, Product, TaxRate } from '@/domain';

describe('Product CRUD (S3-T1)', () => {
  let db: AppDatabase;
  let productRepo: DexieProductRepository;

  const mockCategories: Category[] = [
    {
      id: '018f0000-0000-7000-8000-000000000010',
      name: 'Bebidas',
      sort: 1,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockTaxRates: TaxRate[] = [
    {
      id: '018f0000-0000-7000-8000-000000000020',
      name: 'IVA 16%',
      rateBp: 1600,
      active: true,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    db = createAppDatabase(`test_prod_${Date.now()}_${Math.random()}`);
    productRepo = new DexieProductRepository(db);
  });

  it('ProductDialog: validates fields and adds/removes barcodes dynamically', async () => {
    let savedProduct: Product | null = null;

    render(
      <ProductDialog
        isOpen={true}
        onClose={() => {}}
        onSave={async (p) => {
          savedProduct = p;
        }}
        categories={mockCategories}
        taxRates={mockTaxRates}
      />,
    );

    expect(screen.getByText('Nuevo Producto')).toBeInTheDocument();

    // Fill SKU and Name
    const skuInput = screen.getByPlaceholderText('PROD-001');
    const nameInput = screen.getByPlaceholderText('Coca Cola 500ml');
    fireEvent.change(skuInput, { target: { value: 'SODA-500' } });
    fireEvent.change(nameInput, { target: { value: 'Refresco Cola' } });

    // Add barcode
    const barcodeInput = screen.getByPlaceholderText(/escanear o escribir código/i);
    fireEvent.change(barcodeInput, { target: { value: '7501055300075' } });
    const addBarcodeBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addBarcodeBtn);

    expect(screen.getByText('7501055300075')).toBeInTheDocument();

    // Fill price
    const priceInput = screen.getByLabelText(/precio de venta/i);
    fireEvent.change(priceInput, { target: { value: '25.50' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedProduct).not.toBeNull();
      expect(savedProduct?.sku).toBe('SODA-500');
      expect(savedProduct?.name).toBe('Refresco Cola');
      expect(savedProduct?.priceMinor).toBe(2550); // 25.50 * 100
      expect(savedProduct?.barcodes).toEqual(['7501055300075']);
      expect(savedProduct?.taxRateId).toBe(mockTaxRates[0]?.id);
    });
  });

  it('ProductList: renders products and calls onEdit / onNewProduct', () => {
    const sampleProduct: Product = {
      id: '018f0000-0000-7000-8000-000000000100',
      sku: 'COCA-350',
      name: 'Coca Cola 350ml',
      barcodes: ['7501055300082'],
      categoryId: mockCategories[0]?.id,
      taxRateId: mockTaxRates[0]?.id ?? '',
      priceMinor: 1800,
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    let editedProduct: Product | null = null;
    let newProductClicked = false;

    render(
      <ProductList
        products={[sampleProduct]}
        categories={mockCategories}
        taxRates={mockTaxRates}
        onEdit={(p) => {
          editedProduct = p;
        }}
        onNewProduct={() => {
          newProductClicked = true;
        }}
        searchQuery=""
        onSearchChange={() => {}}
        selectedCategoryId={null}
        onCategoryChange={() => {}}
        activeOnly={false}
        onActiveOnlyChange={() => {}}
      />,
    );

    expect(screen.getByText('COCA-350')).toBeInTheDocument();
    expect(screen.getByText('Coca Cola 350ml')).toBeInTheDocument();
    expect(screen.getByText('7501055300082')).toBeInTheDocument();

    // Click edit
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(editedProduct).toEqual(sampleProduct);

    // Click new
    fireEvent.click(screen.getByRole('button', { name: /nuevo producto/i }));
    expect(newProductClicked).toBe(true);
  });

  it('ProductRepository: saves, filters by search, category, and active status', async () => {
    const prod1: Product = {
      id: '018f0000-0000-7000-8000-000000000001',
      sku: 'JUICE-ORANGE',
      name: 'Jugo de Naranja 1L',
      barcodes: ['123456789012'],
      categoryId: mockCategories[0]?.id,
      taxRateId: mockTaxRates[0]?.id ?? '',
      priceMinor: 3000,
      trackStock: true,
      unit: 'l',
      allowFractional: true,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    const prod2: Product = {
      id: '018f0000-0000-7000-8000-000000000002',
      sku: 'WATER-500',
      name: 'Agua Mineral 500ml',
      barcodes: ['987654321098'],
      categoryId: null,
      taxRateId: mockTaxRates[0]?.id ?? '',
      priceMinor: 1200,
      trackStock: false,
      unit: 'unit',
      allowFractional: false,
      active: false, // Inactive
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await productRepo.save(prod1);
    await productRepo.save(prod2);

    // Filter by search query
    const searchResults = await productRepo.list({ search: 'naranja' });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.id).toBe(prod1.id);

    // Filter by barcode search
    const barcodeResults = await productRepo.list({ search: '987654321098' });
    expect(barcodeResults).toHaveLength(1);
    expect(barcodeResults[0]?.id).toBe(prod2.id);

    // Filter active only
    const activeResults = await productRepo.list({ activeOnly: true });
    expect(activeResults).toHaveLength(1);
    expect(activeResults[0]?.id).toBe(prod1.id);

    // Filter by category
    const catResults = await productRepo.list({ categoryId: mockCategories[0]?.id });
    expect(catResults).toHaveLength(1);
    expect(catResults[0]?.id).toBe(prod1.id);

    // Delete product
    await productRepo.delete(prod1.id);
    expect(await productRepo.getById(prod1.id)).toBeNull();
  });
});
