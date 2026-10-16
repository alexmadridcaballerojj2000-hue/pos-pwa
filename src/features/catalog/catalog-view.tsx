import React, { useEffect, useState, useCallback } from 'react';
import { Package, FolderTree, Receipt, UploadCloud } from 'lucide-react';
import type { Category, Product, TaxRate } from '@/domain';
import { repositories } from '@/data/repositories';
import { ProductList } from './product-list';
import { ProductDialog } from './product-dialog';
import { CategoryManager } from './category-manager';
import { TaxRateManager } from './tax-manager';
import { useI18n } from '@/app/i18n';

type CatalogTab = 'products' | 'categories' | 'taxes' | 'import';

export const CatalogView: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<CatalogTab>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadData = useCallback(
    async (isMountedRef?: () => boolean) => {
      const [prods, cats, taxes] = await Promise.all([
        repositories.products.list({
          search: searchQuery,
          categoryId: selectedCategoryId,
          activeOnly,
        }),
        repositories.categories.list(),
        repositories.taxRates.listAll(),
      ]);

      if (!isMountedRef || isMountedRef()) {
        setProducts(prods);
        setCategories(cats);
        setTaxRates(taxes);
      }
    },
    [searchQuery, selectedCategoryId, activeOnly],
  );

  useEffect(() => {
    let isMounted = true;
    loadData(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const handleSaveProduct = async (product: Product) => {
    await repositories.products.save(product);
    await loadData();
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleSaveCategory = async (category: Category) => {
    await repositories.categories.save(category);
    await loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    await repositories.categories.delete(id);
    await loadData();
  };

  const handleSaveTaxRate = async (taxRate: TaxRate) => {
    await repositories.taxRates.save(taxRate);
    await loadData();
  };

  const handleDeleteTaxRate = async (id: string) => {
    await repositories.taxRates.delete(id);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('catalog.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('catalog.subtitle')}</p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'products'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Productos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'categories'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Categorías</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('taxes')}
            className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'taxes'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Impuestos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'import'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar CSV</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'products' && (
        <ProductList
          products={products}
          categories={categories}
          taxRates={taxRates}
          onEdit={handleEditProduct}
          onNewProduct={handleNewProduct}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
          activeOnly={activeOnly}
          onActiveOnlyChange={setActiveOnly}
        />
      )}

      {activeTab === 'categories' && (
        <CategoryManager
          categories={categories}
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
        />
      )}

      {activeTab === 'taxes' && (
        <TaxRateManager
          taxRates={taxRates}
          onSave={handleSaveTaxRate}
          onDelete={handleDeleteTaxRate}
        />
      )}

      {activeTab === 'import' && (
        <div
          id="import-tab-content"
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
        >
          Asistente de importación CSV.
        </div>
      )}

      {/* Create / Edit Dialog */}
      <ProductDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        categories={categories}
        taxRates={taxRates}
      />
    </div>
  );
};
