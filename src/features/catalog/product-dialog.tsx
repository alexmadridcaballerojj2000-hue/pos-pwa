import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, X, Package } from 'lucide-react';
import {
  generateId,
  type Category,
  type CustomFieldDef,
  type Product,
  type ProductUnit,
  type TaxRate,
} from '@/domain';
import { useI18n } from '@/app/i18n';

const productSchema = z.object({
  sku: z.string().min(1, 'El SKU es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  categoryId: z.string().nullable().optional(),
  taxRateId: z.string().min(1, 'Debe seleccionar una tasa de impuesto'),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  cost: z.number().min(0, 'El costo no puede ser negativo').optional().nullable(),
  trackStock: z.boolean(),
  minStock: z.number().min(0).optional().nullable(),
  unit: z.enum(['unit', 'kg', 'g', 'l', 'ml', 'm']),
  allowFractional: z.boolean(),
  active: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
  product?: Product | null;
  categories: Category[];
  taxRates: TaxRate[];
  customFieldDefs?: CustomFieldDef[];
}

export const ProductDialog: React.FC<ProductDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  categories,
  taxRates,
  customFieldDefs = [],
}) => {
  const { t } = useI18n();
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [newBarcode, setNewBarcode] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      categoryId: null,
      taxRateId: taxRates[0]?.id ?? '',
      price: 0,
      cost: null,
      trackStock: true,
      minStock: 0,
      unit: 'unit',
      allowFractional: false,
      active: true,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        categoryId: product.categoryId ?? null,
        taxRateId: product.taxRateId,
        price: product.priceMinor / 100,
        cost: product.costMinor ? product.costMinor / 100 : null,
        trackStock: product.trackStock,
        minStock: product.minStockMilli ? product.minStockMilli / 1000 : 0,
        unit: product.unit,
        allowFractional: product.allowFractional,
        active: product.active,
      });
      setBarcodes(product.barcodes || []);
      setCustomValues(product.custom || {});
    } else {
      reset({
        sku: '',
        name: '',
        categoryId: categories[0]?.id ?? null,
        taxRateId: taxRates[0]?.id ?? '',
        price: 0,
        cost: null,
        trackStock: true,
        minStock: 0,
        unit: 'unit',
        allowFractional: false,
        active: true,
      });
      setBarcodes([]);
      setCustomValues({});
    }
    setError(null);
  }, [product, categories, taxRates, reset]);

  if (!isOpen) return null;

  const handleAddBarcode = () => {
    const trimmed = newBarcode.trim();
    if (!trimmed) return;
    if (barcodes.includes(trimmed)) {
      setError('El código de barras ya está en la lista');
      return;
    }
    setBarcodes((prev) => [...prev, trimmed]);
    setNewBarcode('');
    setError(null);
  };

  const handleRemoveBarcode = (code: string) => {
    setBarcodes((prev) => prev.filter((b) => b !== code));
  };

  const onSubmit = async (values: ProductFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const nowIso = new Date().toISOString();
      const productToSave: Product = {
        id: product ? product.id : generateId(),
        sku: values.sku.trim(),
        barcodes,
        name: values.name.trim(),
        categoryId: values.categoryId || null,
        taxRateId: values.taxRateId,
        priceMinor: Math.round(values.price * 100),
        costMinor: values.cost ? Math.round(values.cost * 100) : undefined,
        trackStock: values.trackStock,
        minStockMilli: values.minStock ? Math.round(values.minStock * 1000) : undefined,
        unit: values.unit as ProductUnit,
        allowFractional: values.allowFractional,
        active: values.active,
        custom: customValues,
        version: product ? product.version + 1 : 1,
        updatedAt: nowIso,
      };

      await onSave(productToSave);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {product ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Catálogo de artículos para venta e inventario.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sku-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                SKU / Código Interno *
              </label>
              <input
                id="sku-input"
                type="text"
                {...register('sku')}
                placeholder="PROD-001"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
              />
              {errors.sku && <p className="text-xs text-rose-600 mt-1">{errors.sku.message}</p>}
            </div>

            <div>
              <label
                htmlFor="name-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Nombre del Producto *
              </label>
              <input
                id="name-input"
                type="text"
                {...register('name')}
                placeholder="Coca Cola 500ml"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
            </div>
          </div>

          {/* Barcodes manager */}
          <div>
            <label
              htmlFor="barcode-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Códigos de Barras
            </label>
            <div className="flex gap-2">
              <input
                id="barcode-input"
                type="text"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBarcode();
                  }
                }}
                placeholder="Escanear o escribir código (ej. 7501055300075)"
                className="flex-1 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
              />
              <button
                type="button"
                onClick={handleAddBarcode}
                className="min-h-[44px] px-4 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>

            {barcodes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {barcodes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => handleRemoveBarcode(code)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label={`Eliminar código ${code}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Category & Tax Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="category-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Categoría
              </label>
              <select
                id="category-select"
                {...register('categoryId')}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                <option value="">(Sin categoría)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tax-rate-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Tasa de Impuesto *
              </label>
              <select
                id="tax-rate-select"
                {...register('taxRateId')}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                {taxRates.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name} ({tr.rateBp / 100}%)
                  </option>
                ))}
              </select>
              {errors.taxRateId && (
                <p className="text-xs text-rose-600 mt-1">{errors.taxRateId.message}</p>
              )}
            </div>
          </div>

          {/* Pricing & Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="price-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Precio de Venta *
              </label>
              <input
                id="price-input"
                type="number"
                step="0.01"
                {...register('price', { valueAsNumber: true })}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold"
              />
              {errors.price && <p className="text-xs text-rose-600 mt-1">{errors.price.message}</p>}
            </div>

            <div>
              <label
                htmlFor="cost-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Costo (Opcional)
              </label>
              <input
                id="cost-input"
                type="number"
                step="0.01"
                {...register('cost', { valueAsNumber: true })}
                placeholder="0.00"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Unit & Stock controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="unit-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Unidad de Medida
              </label>
              <select
                id="unit-select"
                {...register('unit')}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              >
                <option value="unit">Pieza / Unidad</option>
                <option value="kg">Kilogramo (kg)</option>
                <option value="g">Gramo (g)</option>
                <option value="l">Litro (l)</option>
                <option value="ml">Mililitro (ml)</option>
                <option value="m">Metro (m)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="min-stock-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Stock Mínimo (Alerta)
              </label>
              <input
                id="min-stock-input"
                type="number"
                step="0.001"
                {...register('minStock', { valueAsNumber: true })}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </div>

            <div className="flex flex-col justify-end space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 min-h-[44px]">
                <input
                  type="checkbox"
                  {...register('allowFractional')}
                  className="w-4 h-4 rounded text-emerald-600"
                />
                Permitir cantidades decimales
              </label>
            </div>
          </div>

          {/* Toggles: trackStock & active */}
          <div className="flex flex-wrap gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 min-h-[44px]">
              <input
                type="checkbox"
                {...register('trackStock')}
                className="w-4 h-4 rounded text-emerald-600"
              />
              Controlar inventario / stock
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 min-h-[44px]">
              <input
                type="checkbox"
                {...register('active')}
                className="w-4 h-4 rounded text-emerald-600"
              />
              Producto activo para venta
            </label>
          </div>

          {/* Custom Fields (SPEC §12) */}
          {customFieldDefs.filter((d) => d.entity === 'product').length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Campos Personalizados
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customFieldDefs
                  .filter((d) => d.entity === 'product')
                  .map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={String(customValues[field.key] ?? '')}
                        onChange={(e) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [field.key]:
                              field.type === 'number' ? Number(e.target.value) : e.target.value,
                          }))
                        }
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
