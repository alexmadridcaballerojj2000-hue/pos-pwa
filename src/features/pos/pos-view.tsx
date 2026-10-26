import React, { useEffect, useReducer, useRef, useState, useMemo } from 'react';
import { ShoppingBag, Store } from 'lucide-react';
import type { Category, Product, Settings, TaxRate } from '@/domain';
import {
  cartReducer,
  createEmptyCart,
  DEFAULT_CURRENCY,
  formatMoney,
  type CurrencyConfig,
} from '@/domain';
import { repositories as defaultRepositories, type Repositories } from '@/data/repositories';
import { productSearchIndex } from '@/features/catalog/search-index';
import { useI18n } from '@/app/i18n';
import { CatalogPanel } from './catalog-panel';

export interface PosViewProps {
  onCheckout?: () => void;
  repos?: Repositories;
}

export const PosView: React.FC<PosViewProps> = ({ onCheckout, repos = defaultRepositories }) => {
  const { t } = useI18n();

  // Settings & Reference Data
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mobile navigation tab: 'catalog' | 'cart'
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog');

  // Domain Cart Reducer
  const [cart, dispatchCart] = useReducer(cartReducer, undefined, () =>
    createEmptyCart(settings?.pricesIncludeTax ?? true),
  );

  // Currency configuration
  const currency: CurrencyConfig = useMemo(() => {
    return settings?.currency ?? DEFAULT_CURRENCY;
  }, [settings]);

  // Load initial data
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        const [loadedSettings, loadedCats, loadedTaxes, loadedProducts] = await Promise.all([
          repos.settings.get(),
          repos.categories.list(),
          repos.taxRates.listActive(),
          repos.products.listActive(),
        ]);

        if (!isMounted) return;

        setSettings(loadedSettings);
        setCategories(loadedCats.sort((a, b) => a.sort - b.sort));
        setTaxRates(loadedTaxes);
        setProducts(loadedProducts);

        // Populate search index
        productSearchIndex.indexAll(loadedProducts);

        if (loadedSettings) {
          dispatchCart({
            type: 'SET_PRICES_INCLUDE_TAX',
            payload: loadedSettings.pricesIncludeTax,
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [repos]);

  // Filtered products from in-memory search index
  const filteredProducts = useMemo(() => {
    if (products.length === 0 && !searchQuery) return [];
    return productSearchIndex.search(searchQuery, {
      categoryId: selectedCategoryId,
      activeOnly: true,
      limit: 100,
    });
  }, [searchQuery, selectedCategoryId, products]);

  // Add product to cart handler
  const handleSelectProduct = (product: Product) => {
    // Determine tax rate
    const taxRate = taxRates.find((r) => r.id === product.taxRateId);
    const taxRateBp = taxRate ? taxRate.rateBp : 0;

    dispatchCart({
      type: 'ADD_ITEM',
      payload: {
        lineId: crypto.randomUUID(),
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty: 1000, // 1 unit default
        unitPrice: product.priceMinor,
        taxRateId: product.taxRateId,
        taxRateBp,
      },
    });
  };

  const totalItemsCount = useMemo(() => {
    return cart.items.reduce((acc, item) => acc + item.qty / 1000, 0);
  }, [cart.items]);

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.20))] max-h-[calc(100vh-theme(spacing.20))]">
      <h1 className="sr-only">{t('pos.title')}</h1>

      {/* Mobile Tab Navigation Bar (Hidden on Desktop >= 1024px) */}
      <div className="lg:hidden flex items-center border-b border-border mb-3 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 min-h-[48px] py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'catalog'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Store className="h-4 w-4" />
          {t('pos.catalog')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cart')}
          className={`flex-1 min-h-[48px] py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'cart'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="relative flex items-center">
            <ShoppingBag className="h-4 w-4" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                {totalItemsCount}
              </span>
            )}
          </div>
          {t('pos.cart')} ({formatMoney(cart.totals.total, currency)})
        </button>
      </div>

      {/* Main Grid: Responsive 2-panel layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        {/* Left Panel: Catalog (Always visible on lg, conditional on mobile) */}
        <div
          className={`lg:col-span-7 xl:col-span-8 flex flex-col h-full overflow-hidden ${
            activeTab === 'catalog' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <CatalogPanel
            categories={categories}
            products={filteredProducts}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectProduct={handleSelectProduct}
            currency={currency}
            searchInputRef={searchInputRef}
            isLoading={isLoading}
            className="flex-1 overflow-hidden"
          />

          {/* Sticky Quick-Cart Bar for Mobile when items exist */}
          {totalItemsCount > 0 && (
            <div className="lg:hidden shrink-0 pt-2 border-t border-border mt-2">
              <button
                type="button"
                onClick={() => setActiveTab('cart')}
                className="w-full min-h-[52px] px-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-between shadow-md active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  <span>
                    {totalItemsCount}{' '}
                    {totalItemsCount === 1 ? t('pos.itemCount') : t('pos.itemsCount')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">
                    {formatMoney(cart.totals.total, currency)}
                  </span>
                  <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded">
                    {t('pos.viewCart')} &rarr;
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Cart Container (Always visible on lg, conditional on mobile) */}
        <div
          id="pos-cart-container"
          className={`lg:col-span-5 xl:col-span-4 flex flex-col h-full overflow-hidden border border-border rounded-2xl bg-card p-4 shadow-xs ${
            activeTab === 'cart' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg text-foreground">{t('pos.cart')}</h2>
            </div>
            {cart.items.length > 0 && (
              <button
                type="button"
                onClick={() => dispatchCart({ type: 'CLEAR_CART' })}
                className="min-h-[44px] px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors font-medium"
              >
                {t('common.delete')}
              </button>
            )}
          </div>

          {/* Cart Items List Placeholder (completed in S4-T3) */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {cart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 stroke-1 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">{t('pos.emptyCart')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Seleccione productos del catálogo o escanee un código de barras.
                </p>
              </div>
            ) : (
              cart.lines.map((line) => (
                <div
                  key={line.lineId}
                  className="p-2.5 rounded-xl border border-border/70 bg-background flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate text-foreground">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.qty / 1000} &times; {formatMoney(line.unitPrice, currency)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-foreground">
                      {formatMoney(line.lineTotal, currency)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals Summary */}
          <div className="pt-3 border-t border-border shrink-0 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('pos.subtotal')}</span>
              <span>{formatMoney(cart.totals.subtotal, currency)}</span>
            </div>
            {cart.totals.lineDiscounts > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>{t('pos.lineDiscount')}</span>
                <span>-{formatMoney(cart.totals.lineDiscounts, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>{t('pos.tax')}</span>
              <span>{formatMoney(cart.totals.tax, currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-foreground pt-1 border-t border-border/50">
              <span>{t('pos.total')}</span>
              <span className="text-primary">{formatMoney(cart.totals.total, currency)}</span>
            </div>

            {/* Charge Button */}
            <button
              type="button"
              disabled={cart.items.length === 0}
              onClick={onCheckout}
              className="w-full min-h-[52px] mt-2 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.99] transition-all"
            >
              <span>{t('pos.charge')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
