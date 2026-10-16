import React from 'react';
import { Plus, Search, Tag, Barcode, CheckCircle2, XCircle } from 'lucide-react';
import type { Category, Product, TaxRate } from '@/domain';
import { formatMoney } from '@/domain';

interface ProductListProps {
  products: Product[];
  categories: Category[];
  taxRates: TaxRate[];
  onEdit: (product: Product) => void;
  onNewProduct: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (activeOnly: boolean) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  categories,
  taxRates,
  onEdit,
  onNewProduct,
  searchQuery,
  onSearchChange,
  selectedCategoryId,
  onCategoryChange,
  activeOnly,
  onActiveOnlyChange,
}) => {
  const getCategoryName = (id?: string | null) => {
    if (!id) return '-';
    return categories.find((c) => c.id === id)?.name ?? '-';
  };

  const getTaxRateLabel = (id: string) => {
    const tr = taxRates.find((t) => t.id === id);
    if (!tr) return '-';
    return `${tr.name} (${tr.rateBp / 100}%)`;
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, SKU o código de barras (F2)..."
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2">
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => onCategoryChange(e.target.value ? e.target.value : null)}
            className="h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-medium shadow-sm"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* New product button */}
          <button
            type="button"
            onClick={onNewProduct}
            className="min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow-sm whitespace-nowrap active:scale-98 transition-transform"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Filter Chips / Active Toggle */}
      <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
        <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => onActiveOnlyChange(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
          />
          Mostrar solo productos activos
        </label>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span>
          {products.length}{' '}
          {products.length === 1 ? 'producto encontrado' : 'productos encontrados'}
        </span>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3.5 px-4">SKU / Códigos</th>
                <th className="py-3.5 px-4">Nombre</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4">Precio</th>
                <th className="py-3.5 px-4">Impuesto</th>
                <th className="py-3.5 px-4">Unidad</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onEdit(p)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{p.sku}</div>
                      {p.barcodes.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Barcode className="w-3 h-3" />
                          <span>{p.barcodes[0]}</span>
                          {p.barcodes.length > 1 && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                              +{p.barcodes.length - 1}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {getCategoryName(p.categoryId)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(p.priceMinor)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {getTaxRateLabel(p.taxRateId)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs capitalize">
                      {p.unit}
                      {p.allowFractional ? ' (Frac.)' : ''}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {p.active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(p);
                        }}
                        className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
