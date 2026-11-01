import React, { useEffect, useReducer, useRef, useState, useMemo, useCallback } from 'react';
import { ShoppingBag, Store, AlertCircle } from 'lucide-react';
import type {
  Category,
  Customer,
  Product,
  Settings,
  TaxRate,
  User,
  UUID,
  Sale,
  SaleLine,
  HeldCart,
  Discount,
  CartItemInput,
} from '@/domain';
import {
  cartReducer,
  createEmptyCart,
  DEFAULT_CURRENCY,
  formatMoney,
  type CurrencyConfig,
  v7,
} from '@/domain';
import { repositories as defaultRepositories, type Repositories } from '@/data/repositories';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { productSearchIndex } from '@/features/catalog/search-index';
import { useAuthStore } from '@/features/auth/auth-store';
import { useI18n } from '@/app/i18n';
import { OpenShiftDialog } from '@/features/shifts/open-shift-dialog';
import { CatalogPanel } from './catalog-panel';
import { CartPanel } from './cart-panel';
import { DiscountDialog } from './discount-dialog';
import { CustomerSelectorDialog } from './customer-selector-dialog';
import { HeldCartsDialog, HoldCartDialog } from './held-carts-dialog';
import { CheckoutDialog } from './checkout-dialog';
import { ReceiptModal } from './receipt-modal';
import { completeSale } from './complete-sale';
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

  // Held carts state
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [isHoldCartDialogOpen, setIsHoldCartDialogOpen] = useState(false);
  const [isHeldCartsDialogOpen, setIsHeldCartsDialogOpen] = useState(false);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedSaleCustomerName, setCompletedSaleCustomerName] = useState<string | undefined>(
    undefined,
  );
  const [customersMap, setCustomersMap] = useState<Record<UUID, string>>({});
  const isDraftRestoredRef = useRef(false);

  // Shift guard state (SPEC §6.5 & S7-T5)
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [isOpenShiftDialogOpen, setIsOpenShiftDialogOpen] = useState(false);

  const checkShiftStatus = useCallback(async () => {
    try {
      const current = await repos.shifts.getCurrentOpen();
      setHasOpenShift(!!current);
    } catch {
      setHasOpenShift(null);
    }
  }, [repos.shifts]);

  useEffect(() => {
    checkShiftStatus();
  }, [checkShiftStatus]);

  const paymentMethodLabels = useMemo(() => {
    const map: Record<string, string> = {};
    settings?.paymentMethods?.forEach((pm) => {
      map[pm.id] = pm.label;
    });
    return map;
  }, [settings?.paymentMethods]);

  const loadHeldCarts = useCallback(async () => {
    try {
      const list = await repos.heldCarts.list();
      setHeldCarts(list);
      const custIds = list.map((c) => c.customerId).filter(Boolean) as UUID[];
      if (custIds.length > 0) {
        const custs = await Promise.all(custIds.map((id) => repos.customers.getById(id)));
        const map: Record<UUID, string> = {};
        custs.forEach((c) => {
          if (c) map[c.id] = c.name;
        });
        setCustomersMap((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.error('Failed to load held carts:', err);
    }
  }, [repos.customers, repos.heldCarts]);

  // Restore draft on initial mount
  useEffect(() => {
    let isMounted = true;
    async function restoreDraft() {
      try {
        const draft = await repos.meta.get<{
          items: CartItemInput[];
          orderDiscount?: Discount;
          customerId?: UUID | null;
          notes?: string;
        }>('pos_active_cart_draft');
        if (draft && isMounted && Array.isArray(draft.items) && draft.items.length > 0) {
          draft.items.forEach((item) => {
            dispatchCart({ type: 'ADD_ITEM', payload: item });
          });
          if (draft.orderDiscount) {
            dispatchCart({ type: 'SET_ORDER_DISCOUNT', payload: draft.orderDiscount });
          }
          if (draft.customerId) {
            dispatchCart({ type: 'SET_CUSTOMER', payload: draft.customerId });
            const cust = await repos.customers.getById(draft.customerId);
            if (isMounted && cust) {
              setSelectedCustomer(cust);
            }
          }
          if (draft.notes) {
            dispatchCart({ type: 'SET_NOTES', payload: draft.notes });
          }
        }
      } catch (err) {
        console.error('Failed to restore cart draft:', err);
      } finally {
        if (isMounted) isDraftRestoredRef.current = true;
      }
    }

    restoreDraft();
    loadHeldCarts();

    return () => {
      isMounted = false;
    };
  }, [repos.meta, repos.customers, loadHeldCarts]);

  // Debounced auto-save draft to meta
  useEffect(() => {
    if (!isDraftRestoredRef.current) return;

    const timer = setTimeout(async () => {
      try {
        if (cart.items.length > 0) {
          const draft = {
            items: cart.items,
            orderDiscount: cart.orderDiscount,
            customerId: cart.customerId,
            notes: cart.notes,
          };
          await repos.meta.set('pos_active_cart_draft', draft);
        } else {
          await repos.meta.set('pos_active_cart_draft', null);
        }
      } catch (err) {
        console.error('Failed to auto-save cart draft:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cart.items, cart.orderDiscount, cart.customerId, cart.notes, repos.meta]);

  const handleHoldCart = useCallback(
    async (label?: string) => {
      if (cart.items.length === 0) return;

      const newHeldCart: HeldCart = {
        id: v7(),
        cashierId: activeUser?.id ?? '00000000-0000-0000-0000-000000000000',
        label:
          label ||
          `Venta ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        lines: cart.items,
        customerId: cart.customerId ?? undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (newHeldCart as unknown as { cartData: unknown }).cartData = {
        orderDiscount: cart.orderDiscount,
        notes: cart.notes,
        totals: cart.totals,
      };

      await repos.heldCarts.save(newHeldCart);
      dispatchCart({ type: 'CLEAR_CART' });
      await repos.meta.set('pos_active_cart_draft', null);
      await loadHeldCarts();
    },
    [cart, activeUser?.id, repos.heldCarts, repos.meta, loadHeldCarts],
  );

  const handleResumeCart = useCallback(
    async (heldCart: HeldCart) => {
      dispatchCart({ type: 'CLEAR_CART' });

      const lines = heldCart.lines as CartItemInput[];
      if (Array.isArray(lines)) {
        lines.forEach((item) => {
          dispatchCart({ type: 'ADD_ITEM', payload: item });
        });
      }

      const anyHc = heldCart as unknown as {
        cartData?: { orderDiscount?: Discount; notes?: string };
      };
      if (anyHc.cartData?.orderDiscount) {
        dispatchCart({ type: 'SET_ORDER_DISCOUNT', payload: anyHc.cartData.orderDiscount });
      }
      if (heldCart.customerId) {
        dispatchCart({ type: 'SET_CUSTOMER', payload: heldCart.customerId });
      }
      if (anyHc.cartData?.notes) {
        dispatchCart({ type: 'SET_NOTES', payload: anyHc.cartData.notes });
      }

      await repos.heldCarts.delete(heldCart.id);
      await loadHeldCarts();
    },
    [repos.heldCarts, loadHeldCarts],
  );

  const handleDiscardHeldCart = useCallback(
    async (heldCartId: UUID) => {
      await repos.heldCarts.delete(heldCartId);
      await loadHeldCarts();
    },
    [repos.heldCarts, loadHeldCarts],
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
      searchInputRef.current?.focus();
    },
  });

  const handleOpenCheckout = useCallback(() => {
    if (cart.lines.length === 0) return;
    if (settings?.requireShift && !hasOpenShift) {
      setIsOpenShiftDialogOpen(true);
      return;
    }
    if (onCheckout) {
      onCheckout();
    } else {
      setIsCheckoutDialogOpen(true);
    }
  }, [cart.lines.length, settings?.requireShift, hasOpenShift, onCheckout]);

  // Keyboard shortcuts: F2 (Search), F4 (Checkout), Escape (Close dialog / clear search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('catalog');
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleOpenCheckout();
      } else if (e.key === 'Escape') {
        if (isCheckoutDialogOpen) {
          setIsCheckoutDialogOpen(false);
          e.preventDefault();
        } else if (editingDiscount) {
          setEditingDiscount(null);
          e.preventDefault();
        } else if (isCustomerSelectorOpen) {
          setIsCustomerSelectorOpen(false);
          e.preventDefault();
        } else if (isHoldCartDialogOpen) {
          setIsHoldCartDialogOpen(false);
          e.preventDefault();
        } else if (isHeldCartsDialogOpen) {
          setIsHeldCartsDialogOpen(false);
          e.preventDefault();
        } else if (searchQuery) {
          setSearchQuery('');
          e.preventDefault();
        }
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    handleOpenCheckout,
    isCheckoutDialogOpen,
    editingDiscount,
    isCustomerSelectorOpen,
    isHoldCartDialogOpen,
    isHeldCartsDialogOpen,
    searchQuery,
  ]);

  const totalItemsCount = useMemo(() => {
    return cart.items.reduce((acc, item) => acc + item.qty / 1000, 0);
  }, [cart.items]);

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.20))] max-h-[calc(100vh-theme(spacing.20))]">
      <h1 className="sr-only">{t('pos.title')}</h1>

      {/* Shift required warning banner (SPEC §6.5 & S7-T5) */}
      {settings?.requireShift && hasOpenShift === false && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300 shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{t('shifts.requireShiftAlert')}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpenShiftDialogOpen(true)}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors shrink-0"
          >
            {t('shifts.openShift')}
          </button>
        </div>
      )}

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
            heldCartsCount={heldCarts.length}
            onHoldCart={() => setIsHoldCartDialogOpen(true)}
            onOpenHeldCarts={() => setIsHeldCartsDialogOpen(true)}
            onClearCart={() => {
              dispatchCart({ type: 'CLEAR_CART' });
              repos.meta.set('pos_active_cart_draft', null).catch(console.error);
            }}
            onCheckout={handleOpenCheckout}
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

      {/* Hold Cart Dialog */}
      {isHoldCartDialogOpen && (
        <HoldCartDialog
          isOpen={isHoldCartDialogOpen}
          onClose={() => setIsHoldCartDialogOpen(false)}
          onConfirmHold={handleHoldCart}
        />
      )}

      {/* Held Carts List Dialog */}
      {isHeldCartsDialogOpen && (
        <HeldCartsDialog
          isOpen={isHeldCartsDialogOpen}
          onClose={() => setIsHeldCartsDialogOpen(false)}
          heldCarts={heldCarts}
          currency={currency}
          customersMap={customersMap}
          hasActiveCartItems={cart.items.length > 0}
          onResumeCart={handleResumeCart}
          onDiscardCart={handleDiscardHeldCart}
        />
      )}

      {/* Checkout Dialog */}
      {isCheckoutDialogOpen && (
        <CheckoutDialog
          isOpen={isCheckoutDialogOpen}
          onClose={() => setIsCheckoutDialogOpen(false)}
          cart={cart}
          currency={currency}
          paymentMethods={settings?.paymentMethods ?? []}
          customerName={selectedCustomer?.name}
          onCompleteSale={async (params) => {
            const cashierId = activeUser?.id ?? ('00000000-0000-0000-0000-000000000000' as UUID);
            const sale = await completeSale(db, {
              saleId: params.saleId,
              cart,
              payments: params.payments,
              change: params.change,
              cashierId,
              currency,
              settings,
            });
            setIsCheckoutDialogOpen(false);
            dispatchCart({ type: 'CLEAR_CART' });
            setCompletedSale(sale);
            setCompletedSaleCustomerName(selectedCustomer?.name);
          }}
        />
      )}

      {/* Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          isOpen={Boolean(completedSale)}
          onClose={() => {
            setCompletedSale(null);
            setCompletedSaleCustomerName(undefined);
          }}
          sale={completedSale}
          business={
            settings?.business ?? {
              name: 'Mi Negocio',
            }
          }
          currency={currency}
          cashierName={activeUser?.name}
          customerName={completedSaleCustomerName}
          paymentMethodLabels={paymentMethodLabels}
          initialPaperWidthMm={settings?.receipt?.paperWidthMm ?? 80}
          onNewSale={() => {
            setCompletedSale(null);
            setCompletedSaleCustomerName(undefined);
          }}
        />
      )}

      {/* Open Shift Dialog Guard */}
      <OpenShiftDialog
        isOpen={isOpenShiftDialogOpen}
        onClose={() => setIsOpenShiftDialogOpen(false)}
        currency={currency}
        onShiftOpened={() => {
          setHasOpenShift(true);
          // If items already in cart, proceed to checkout immediately
          if (cart.lines.length > 0) {
            setIsCheckoutDialogOpen(true);
          }
        }}
      />
    </div>
  );
};
