import React, { useEffect, useReducer, useRef, useState, useMemo, useCallback } from 'react';
import { ShoppingBag, Store } from 'lucide-react';
import type {
  Category,
  Customer,
  Product,
  Settings,
  TaxRate,
  User,
  UUID,
  SaleLine,
} from '@/domain';
import {
  cartReducer,
  createEmptyCart,
  DEFAULT_CURRENCY,
  formatMoney,
  type CurrencyConfig,
} from '@/domain';
import { repositories as defaultRepositories, type Repositories } from '@/data/repositories';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { productSearchIndex } from '@/features/catalog/search-index';
import { useAuthStore } from '@/features/auth/auth-store';
import { useI18n } from '@/app/i18n';
import { CatalogPanel } from './catalog-panel';
import { CartPanel } from './cart-panel';
import { DiscountDialog } from './discount-dialog';
import { CustomerSelectorDialog } from './customer-selector-dialog';
import { useBarcodeScanner } from './use-barcode-scanner';

export interface PosViewProps {
  onCheckout?: () => void;
  repos?: Repositories;
  currentUser?: User | null;
  db?: AppDatabase;
}

export const PosView: React.FC<PosViewProps> = ({
  onCheckout,
  repos = defaultRepositories,
  currentUser: propUser,
  db = defaultDb,
}) => {
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

  // Auth User resolution
  const storeUser = useAuthStore((s) => s.currentUser);
  const activeUser = propUser !== undefined ? propUser : storeUser;

  // Discount dialog state
  const [editingDiscount, setEditingDiscount] = useState<
    { target: 'order' } | { target: 'line'; lineId: UUID; line: SaleLine } | null
  >(null);

  // Domain Cart Reducer
  const [cart, dispatchCart] = useReducer(cartReducer, undefined, () =>
    createEmptyCart(settings?.pricesIncludeTax ?? true),
  );

  // Customer selector state
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Synchronize selectedCustomer with cart.customerId
  useEffect(() => {
    let isMounted = true;
    if (!cart.customerId) {
      setSelectedCustomer(null);
      return;
    }
    // Only fetch if different from current selectedCustomer
    if (selectedCustomer?.id !== cart.customerId) {
      repos.customers.getById(cart.customerId).then((c) => {
        if (isMounted) setSelectedCustomer(c ?? null);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [cart.customerId, repos.customers, selectedCustomer?.id]);

  const handleSelectCustomer = useCallback((customer: Customer | null) => {
    setSelectedCustomer(customer);
    dispatchCart({ type: 'SET_CUSTOMER', payload: customer?.id ?? null });
  }, []);

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
  const handleSelectProduct = useCallback(
    (product: Product) => {
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
    },
    [taxRates],
  );

  // Hardware barcode scanner hook (< 35 ms keystroke burst + Enter)
  useBarcodeScanner({
    onScan: (barcode) => {
      const product = productSearchIndex.lookupByBarcode(barcode);
      if (product) {
        handleSelectProduct(product);
      } else {
        setSearchQuery(barcode);
      }
    },
  });

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
          className={`lg:col-span-5 xl:col-span-4 h-full overflow-hidden ${
            activeTab === 'cart' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <CartPanel
            cart={cart}
            currency={currency}
            onUpdateQty={(lineId, qty) =>
              dispatchCart({ type: 'UPDATE_QTY', payload: { lineId, qty } })
            }
            onRemoveItem={(lineId) => dispatchCart({ type: 'REMOVE_ITEM', payload: { lineId } })}
            onSetLineNote={(lineId, note) =>
              dispatchCart({ type: 'SET_LINE_NOTE', payload: { lineId, note } })
            }
            onSetLineDiscount={(lineId) => {
              const line = cart.lines.find((l) => l.lineId === lineId);
              if (line) {
                setEditingDiscount({ target: 'line', lineId, line });
              }
            }}
            onSetOrderDiscount={() => {
              setEditingDiscount({ target: 'order' });
            }}
            customerName={selectedCustomer?.name}
            onSelectCustomer={() => setIsCustomerSelectorOpen(true)}
            onClearCustomer={() => handleSelectCustomer(null)}
            onClearCart={() => dispatchCart({ type: 'CLEAR_CART' })}
            onCheckout={onCheckout}
            className="flex-1 overflow-hidden"
          />
        </div>
      </div>

      {/* Discount Dialog */}
      {editingDiscount && (
        <DiscountDialog
          isOpen={true}
          onClose={() => setEditingDiscount(null)}
          title={
            editingDiscount.target === 'order'
              ? t('pos.orderDiscount')
              : `${t('pos.lineDiscount')} — ${editingDiscount.line.name}`
          }
          baseAmount={
            editingDiscount.target === 'order'
              ? cart.lines.reduce((acc, l) => acc + (l.lineBase - l.lineDiscount), 0)
              : editingDiscount.line.lineBase
          }
          initialDiscount={
            editingDiscount.target === 'order' ? cart.orderDiscount : editingDiscount.line.discount
          }
          currency={currency}
          maxDiscountBp={settings?.maxDiscountBp ?? 1000}
          currentUser={activeUser}
          db={db}
          onApplyDiscount={(discount) => {
            if (editingDiscount.target === 'order') {
              dispatchCart({ type: 'SET_ORDER_DISCOUNT', payload: discount });
            } else {
              dispatchCart({
                type: 'SET_LINE_DISCOUNT',
                payload: { lineId: editingDiscount.lineId, discount },
              });
            }
          }}
          onRemoveDiscount={() => {
            if (editingDiscount.target === 'order') {
              dispatchCart({ type: 'SET_ORDER_DISCOUNT', payload: undefined });
            } else {
              dispatchCart({
                type: 'SET_LINE_DISCOUNT',
                payload: { lineId: editingDiscount.lineId, discount: undefined },
              });
            }
          }}
        />
      )}

      {/* Customer Selector Dialog */}
      {isCustomerSelectorOpen && (
        <CustomerSelectorDialog
          isOpen={isCustomerSelectorOpen}
          onClose={() => setIsCustomerSelectorOpen(false)}
          currentCustomerId={cart.customerId}
          onSelectCustomer={handleSelectCustomer}
          db={db}
          customerRepo={repos.customers}
        />
      )}
    </div>
  );
};
