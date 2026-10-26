import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { createRepositories } from '@/data/repositories';
import { productSearchIndex } from '@/features/catalog/search-index';
import type { Category, Product, TaxRate, Settings } from '@/domain';
import { DEFAULT_CURRENCY } from '@/domain';
import { CatalogPanel } from './catalog-panel';
import { PosView } from './pos-view';

describe('POS Layout & Catalog (S4-T1)', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Bebidas',
      sort: 1,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat-2',
      name: 'Snacks',
      sort: 2,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockTaxRates: TaxRate[] = [
    {
      id: 'tax-1',
      name: 'IVA 16%',
      rateBp: 1600,
      active: true,
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      sku: 'BEV-001',
      barcodes: ['75010001'],
      name: 'Refresco Cola 600ml',
      categoryId: 'cat-1',
      priceMinor: 2000, // $20.00
      taxRateId: 'tax-1',
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-2',
      sku: 'SNK-001',
      barcodes: ['75010002'],
      name: 'Papas Fritas 150g',
      categoryId: 'cat-2',
      priceMinor: 2500, // $25.00
      taxRateId: 'tax-1',
      trackStock: true,
      unit: 'unit',
      allowFractional: false,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-3',
      sku: 'FRU-001',
      barcodes: ['75010003'],
      name: 'Manzana Roja',
      categoryId: null,
      priceMinor: 4500, // $45.00 / kg
      taxRateId: 'tax-1',
      trackStock: true,
      unit: 'kg',
      allowFractional: true,
      active: true,
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  describe('CatalogPanel', () => {
    it('renders search input with F2 badge and category tabs', () => {
      const onSelectCategory = vi.fn();
      const onSearchChange = vi.fn();
      const onSelectProduct = vi.fn();

      render(
        <CatalogPanel
          categories={mockCategories}
          products={mockProducts}
          selectedCategoryId={null}
          onSelectCategory={onSelectCategory}
          searchQuery=""
          onSearchChange={onSearchChange}
          onSelectProduct={onSelectProduct}
          currency={DEFAULT_CURRENCY}
        />,
      );

      // Search bar
      expect(screen.getByPlaceholderText(/Buscar producto o código/i)).toBeInTheDocument();
      expect(screen.getByText('F2')).toBeInTheDocument();

      // Category chips
      expect(screen.getByRole('tab', { name: 'Todas' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Bebidas' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Snacks' })).toBeInTheDocument();

      // Products rendered
      expect(screen.getByText('Refresco Cola 600ml')).toBeInTheDocument();
      expect(screen.getByText('Papas Fritas 150g')).toBeInTheDocument();
      expect(screen.getByText('Manzana Roja')).toBeInTheDocument();
    });

    it('handles category selection and search change', () => {
      const onSelectCategory = vi.fn();
      const onSearchChange = vi.fn();
      const onSelectProduct = vi.fn();

      render(
        <CatalogPanel
          categories={mockCategories}
          products={mockProducts}
          selectedCategoryId={null}
          onSelectCategory={onSelectCategory}
          searchQuery="cola"
          onSearchChange={onSearchChange}
          onSelectProduct={onSelectProduct}
          currency={DEFAULT_CURRENCY}
        />,
      );

      // Click on Snacks
      fireEvent.click(screen.getByRole('tab', { name: 'Snacks' }));
      expect(onSelectCategory).toHaveBeenCalledWith('cat-2');

      // Click clear search
      const clearButton = screen.getByRole('button', { name: /Cancelar/i });
      fireEvent.click(clearButton);
      expect(onSearchChange).toHaveBeenCalledWith('');
    });

    it('triggers onSelectProduct when a product card is clicked or activated with Enter', () => {
      const onSelectProduct = vi.fn();

      render(
        <CatalogPanel
          categories={mockCategories}
          products={mockProducts}
          selectedCategoryId={null}
          onSelectCategory={() => {}}
          searchQuery=""
          onSearchChange={() => {}}
          onSelectProduct={onSelectProduct}
          currency={DEFAULT_CURRENCY}
        />,
      );

      const productCard = screen.getByRole('button', {
        name: /Agregar Refresco Cola 600ml/i,
      });

      // Click
      fireEvent.click(productCard);
      expect(onSelectProduct).toHaveBeenCalledWith(mockProducts[0]);

      // Keyboard Enter
      fireEvent.keyDown(productCard, { key: 'Enter' });
      expect(onSelectProduct).toHaveBeenCalledTimes(2);
    });

    it('renders empty state when products list is empty', () => {
      render(
        <CatalogPanel
          categories={mockCategories}
          products={[]}
          selectedCategoryId={null}
          onSelectCategory={() => {}}
          searchQuery="inexistente"
          onSearchChange={() => {}}
          onSelectProduct={() => {}}
          currency={DEFAULT_CURRENCY}
        />,
      );

      expect(screen.getByText('No se encontraron productos')).toBeInTheDocument();
    });
  });

  describe('PosView integration', () => {
    let db: AppDatabase;
    let repos: ReturnType<typeof createRepositories>;

    beforeEach(async () => {
      db = createAppDatabase(`test_pos_layout_${Date.now()}_${Math.random()}`);
      repos = createRepositories(db);

      // Seed reference data
      const defaultSettings: Settings = {
        id: 'singleton',
        business: { name: 'Tienda Test' },
        currency: { code: 'MXN', decimals: 2, symbol: '$' },
        pricesIncludeTax: false,
        requireShift: false,
        allowNegativeStock: true,
        maxDiscountBp: 1000,
        paymentMethods: [
          { id: 'cash', label: 'Efectivo', kind: 'cash', active: true, requireReference: false },
        ],
        modules: {},
        receipt: { paperWidthMm: 80, template: { header: [], items: [], totals: [], footer: [] } },
        mode: 'local',
      };

      await repos.settings.save(defaultSettings);
      for (const cat of mockCategories) {
        await repos.categories.save(cat);
      }
      for (const tax of mockTaxRates) {
        await repos.taxRates.save(tax);
      }
      for (const prod of mockProducts) {
        await repos.products.save(prod);
      }

      productSearchIndex.indexAll(mockProducts);
    });

    it('renders catalog and cart in 2-panel layout and allows adding products to cart', async () => {
      render(<PosView repos={repos} />);

      await waitFor(() => {
        expect(screen.getByText('Refresco Cola 600ml')).toBeInTheDocument();
      });

      // Initially cart is empty
      expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();

      // Click on product card
      const colaCard = screen.getByRole('button', {
        name: /Agregar Refresco Cola 600ml/i,
      });
      fireEvent.click(colaCard);

      // Cart now has Refresco Cola 600ml and total
      await waitFor(() => {
        expect(screen.getAllByText('Refresco Cola 600ml').length).toBeGreaterThan(1);
      });

      // Price is 2000 + 16% tax (320) = 2320 minor -> $23.20
      expect(screen.getByRole('button', { name: /Cobrar/i })).not.toBeDisabled();

      // Delete/Clear cart
      const clearCartBtn = screen.getByRole('button', { name: /Eliminar/i });
      fireEvent.click(clearCartBtn);

      await waitFor(() => {
        expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
      });
    });

    it('supports mobile tab switching between catalog and cart', async () => {
      render(<PosView repos={repos} />);

      await waitFor(() => {
        expect(screen.getByText('Refresco Cola 600ml')).toBeInTheDocument();
      });

      // Mobile tab buttons: Catálogo and Carrito
      const mobileTabs = screen.getAllByRole('button', { name: /Catálogo/i });
      expect(mobileTabs.length).toBeGreaterThan(0);

      // Click product
      const colaCard = screen.getByRole('button', {
        name: /Agregar Refresco Cola 600ml/i,
      });
      fireEvent.click(colaCard);

      // Click mobile cart tab
      const cartTab = screen.getByRole('button', { name: /Carrito \(/i });
      fireEvent.click(cartTab);

      // Cart container should now be active
      expect(screen.getByText('Cobrar (F4)')).toBeInTheDocument();
    });
  });
});
