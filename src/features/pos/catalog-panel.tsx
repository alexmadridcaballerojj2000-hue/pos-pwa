import React from 'react';
import { Search, X, Package, Tag } from 'lucide-react';
import type { Category, Product } from '@/domain';
import { formatMoney, type CurrencyConfig } from '@/domain';
import { useI18n } from '@/app/i18n';

export interface CatalogPanelProps {
  categories: Category[];
  products: Product[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectProduct: (product: Product) => void;
  currency: CurrencyConfig;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  isLoading?: boolean;
  className?: string;
}

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
  categories,
  products,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSelectProduct,
  currency,
  searchInputRef,
  isLoading = false,
  className = '',
}) => {
  const { t } = useI18n();

  const handleKeyDown = (e: React.KeyboardEvent, product: Product) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectProduct(product);
    }
  };

  return (
    <div className={`flex flex-col h-full space-y-3 ${className}`}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('pos.searchPlaceholder')}
          aria-label={t('pos.searchPlaceholder')}
          className="w-full h-12 pl-11 pr-20 rounded-xl border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={t('common.cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground bg-muted border border-border rounded shadow-xs">
            F2
          </kbd>
        </div>
      </div>

      {/* Category Chips Bar */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
        role="tablist"
        aria-label={t('pos.catalog')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategoryId === null}
          onClick={() => onSelectCategory(null)}
          className={`shrink-0 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            selectedCategoryId === null
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {t('pos.allCategories')}
        </button>

        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectCategory(category.id)}
              className={`shrink-0 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="p-3 min-h-[104px] rounded-xl border border-border bg-card animate-pulse flex flex-col justify-between"
              >
                <div>
                  <div className="h-3 bg-muted rounded w-16 mb-2" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-1" />
                </div>
                <div className="pt-2 border-t border-border/50 flex justify-between">
                  <div className="h-5 bg-muted rounded w-14" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-muted rounded-2xl">
            <Package className="h-10 w-10 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">{t('pos.noProductsFound')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Pruebe cambiando el filtro de categoría o el término de búsqueda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-4">
            {products.map((product) => (
              <div
                key={product.id}
                role="button"
                tabIndex={0}
                aria-label={`Agregar ${product.name} ${formatMoney(product.priceMinor, currency)}`}
                onClick={() => onSelectProduct(product)}
                onKeyDown={(e) => handleKeyDown(e, product)}
                className="group relative flex flex-col justify-between p-3 min-h-[104px] rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/50 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">
                      {product.sku}
                    </span>
                    {product.allowFractional && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold uppercase">
                        {product.unit}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-snug">
                    {product.name}
                  </h3>
                </div>

                <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                  <span className="font-bold text-base text-primary">
                    {formatMoney(product.priceMinor, currency)}
                  </span>
                  <Tag className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
