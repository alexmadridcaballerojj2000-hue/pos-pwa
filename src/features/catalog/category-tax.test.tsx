import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { DexieCategoryRepository, DexieTaxRateRepository } from '@/data/repositories';
import { CategoryManager } from './category-manager';
import { getDescendantIds } from './category-utils';
import { TaxRateManager } from './tax-manager';
import type { Category, TaxRate } from '@/domain';

describe('Hierarchical Categories & Taxes (S3-T2)', () => {
  let db: AppDatabase;
  let categoryRepo: DexieCategoryRepository;
  let taxRateRepo: DexieTaxRateRepository;

  beforeEach(() => {
    db = createAppDatabase(`test_cat_tax_${Date.now()}_${Math.random()}`);
    categoryRepo = new DexieCategoryRepository(db);
    taxRateRepo = new DexieTaxRateRepository(db);
  });

  describe('CategoryManager & Repositories', () => {
    const sampleCategories: Category[] = [
      {
        id: 'cat-root-1',
        name: 'Bebidas',
        parentId: null,
        sort: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'cat-sub-1',
        name: 'Gaseosas',
        parentId: 'cat-root-1',
        sort: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'cat-sub-2',
        name: 'Jugos',
        parentId: 'cat-root-1',
        sort: 2,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'cat-sub-sub-1',
        name: 'Jugos Naturales',
        parentId: 'cat-sub-2',
        sort: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    ];

    it('detects descendant IDs correctly to prevent cyclical hierarchies', () => {
      const descendantsOfRoot = getDescendantIds('cat-root-1', sampleCategories);
      expect(descendantsOfRoot.has('cat-sub-1')).toBe(true);
      expect(descendantsOfRoot.has('cat-sub-2')).toBe(true);
      expect(descendantsOfRoot.has('cat-sub-sub-1')).toBe(true);

      const descendantsOfJugos = getDescendantIds('cat-sub-2', sampleCategories);
      expect(descendantsOfJugos.has('cat-sub-sub-1')).toBe(true);
      expect(descendantsOfJugos.has('cat-sub-1')).toBe(false);
      expect(descendantsOfJugos.has('cat-root-1')).toBe(false);
    });

    it('renders categories tree and allows creating a new category', async () => {
      let savedCategory: Category | null = null;
      let deletedId: string | null = null;

      render(
        <CategoryManager
          categories={sampleCategories}
          onSave={async (c) => {
            savedCategory = c;
          }}
          onDelete={async (id) => {
            deletedId = id;
          }}
        />,
      );

      // Verify hierarchical display
      expect(screen.getByText('Bebidas')).toBeInTheDocument();
      expect(screen.getByText('Gaseosas')).toBeInTheDocument();
      expect(screen.getByText('Jugos')).toBeInTheDocument();
      expect(screen.getByText('Jugos Naturales')).toBeInTheDocument();

      // Open new modal
      const newBtn = screen.getByRole('button', { name: /nueva categoría/i });
      fireEvent.click(newBtn);

      expect(screen.getByRole('heading', { name: /nueva categoría/i })).toBeInTheDocument();

      // Fill name and submit
      const nameInput = screen.getByLabelText(/nombre de la categoría/i);
      fireEvent.change(nameInput, { target: { value: 'Snacks' } });

      const saveBtn = screen.getByRole('button', { name: /guardar/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(savedCategory).not.toBeNull();
        expect(savedCategory?.name).toBe('Snacks');
        expect(savedCategory?.parentId).toBeNull();
      });

      // Click delete on Jugos
      const deleteBtn = screen.getByRole('button', { name: 'Eliminar Jugos' });
      fireEvent.click(deleteBtn);
      expect(deletedId).toBe('cat-sub-2');
    });

    it('DexieCategoryRepository saves, lists in sort order, and deletes', async () => {
      await categoryRepo.save(sampleCategories[1]!);
      await categoryRepo.save(sampleCategories[0]!);

      const list = await categoryRepo.list();
      expect(list).toHaveLength(2);

      await categoryRepo.delete('cat-root-1');
      expect(await categoryRepo.getById('cat-root-1')).toBeNull();
    });
  });

  describe('TaxRateManager & Repositories', () => {
    const sampleTaxes: TaxRate[] = [
      {
        id: 'tax-16',
        name: 'IVA General',
        rateBp: 1600,
        active: true,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tax-0',
        name: 'Exento',
        rateBp: 0,
        active: false,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    ];

    it('renders tax rates and converts percent to basis points when saving', async () => {
      let savedTaxRate: TaxRate | null = null;
      let deletedTaxId: string | null = null;

      render(
        <TaxRateManager
          taxRates={sampleTaxes}
          onSave={async (tr) => {
            savedTaxRate = tr;
          }}
          onDelete={async (id) => {
            deletedTaxId = id;
          }}
        />,
      );

      expect(screen.getByText('IVA General')).toBeInTheDocument();
      expect(screen.getByText('16.00%')).toBeInTheDocument();
      expect(screen.getByText('Exento')).toBeInTheDocument();
      expect(screen.getByText('0.00%')).toBeInTheDocument();

      // Open new tax rate modal
      const newBtn = screen.getByRole('button', { name: /nueva tasa/i });
      fireEvent.click(newBtn);

      const nameInput = screen.getByLabelText(/nombre de la tasa/i);
      fireEvent.change(nameInput, { target: { value: 'IEPS 8%' } });

      const rateInput = screen.getByLabelText(/porcentaje/i);
      fireEvent.change(rateInput, { target: { value: '8' } });

      const saveBtn = screen.getByRole('button', { name: /guardar/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(savedTaxRate).not.toBeNull();
        expect(savedTaxRate?.name).toBe('IEPS 8%');
        expect(savedTaxRate?.rateBp).toBe(800); // 8 * 100 bp
        expect(savedTaxRate?.active).toBe(true);
      });

      // Toggle active by clicking on status button
      const activeBtn = screen.getByText('Activo');
      fireEvent.click(activeBtn);
      await waitFor(() => {
        expect(savedTaxRate?.id).toBe('tax-16');
        expect(savedTaxRate?.active).toBe(false);
      });

      // Delete tax
      const deleteBtn = screen.getByRole('button', { name: /eliminar exento/i });
      fireEvent.click(deleteBtn);
      expect(deletedTaxId).toBe('tax-0');
    });

    it('DexieTaxRateRepository handles listAll, listActive, and delete', async () => {
      await taxRateRepo.save(sampleTaxes[0]!);
      await taxRateRepo.save(sampleTaxes[1]!);

      const all = await taxRateRepo.listAll();
      expect(all).toHaveLength(2);

      const activeOnly = await taxRateRepo.listActive();
      expect(activeOnly).toHaveLength(1);
      expect(activeOnly[0]?.name).toBe('IVA General');

      await taxRateRepo.delete('tax-16');
      expect(await taxRateRepo.getById('tax-16')).toBeNull();
    });
  });
});
