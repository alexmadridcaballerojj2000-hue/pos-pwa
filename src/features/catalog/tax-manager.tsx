import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Receipt, CheckCircle, XCircle } from 'lucide-react';
import { generateId, type TaxRate } from '@/domain';
import { useI18n } from '@/app/i18n';

interface TaxRateManagerProps {
  taxRates: TaxRate[];
  onSave: (taxRate: TaxRate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const TaxRateManager: React.FC<TaxRateManagerProps> = ({ taxRates, onSave, onDelete }) => {
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null);

  const [name, setName] = useState('');
  const [ratePercent, setRatePercent] = useState<number>(16);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingTaxRate(null);
    setName('');
    setRatePercent(16);
    setActive(true);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (taxRate: TaxRate) => {
    setEditingTaxRate(taxRate);
    setName(taxRate.name);
    setRatePercent(taxRate.rateBp / 100);
    setActive(taxRate.active);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('El nombre del impuesto es obligatorio');
      return;
    }
    if (ratePercent < 0 || ratePercent > 100) {
      setError('El porcentaje de impuesto debe estar entre 0% y 100%');
      return;
    }

    const nowIso = new Date().toISOString();
    const rateBp = Math.round(ratePercent * 100);

    const taxToSave: TaxRate = {
      id: editingTaxRate ? editingTaxRate.id : generateId(),
      name: trimmed,
      rateBp,
      active,
      version: editingTaxRate ? editingTaxRate.version + 1 : 1,
      updatedAt: nowIso,
    };

    try {
      await onSave(taxToSave);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar impuesto');
    }
  };

  const toggleActive = async (taxRate: TaxRate) => {
    const updated: TaxRate = {
      ...taxRate,
      active: !taxRate.active,
      version: taxRate.version + 1,
      updatedAt: new Date().toISOString(),
    };
    await onSave(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Tasas de Impuestos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define las tasas impositivas aplicables a los productos en ventas (ej. IVA, IEPS o
            Exento).
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Tasa
        </button>
      </div>

      {/* Tax Rates List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Nombre</th>
              <th className="py-3 px-4">Porcentaje</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {taxRates.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                  No hay tasas impositivas configuradas.
                </td>
              </tr>
            ) : (
              taxRates.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {tr.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {(tr.rateBp / 100).toFixed(2)}%
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => toggleActive(tr)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium min-h-[36px]"
                    >
                      {tr.active ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-300">Activo</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-500">Inactivo</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(tr)}
                        className="min-h-[44px] min-w-[44px] p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center rounded-lg"
                        aria-label={`Editar ${tr.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(tr.id)}
                        className="min-h-[44px] min-w-[44px] p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center rounded-lg"
                        aria-label={`Eliminar ${tr.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tax Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingTaxRate ? 'Editar Tasa Impositiva' : 'Nueva Tasa Impositiva'}
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="tax-name-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nombre de la Tasa *
                </label>
                <input
                  id="tax-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. IVA General (16%)"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="tax-rate-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Porcentaje (%) *
                </label>
                <div className="relative">
                  <input
                    id="tax-rate-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={ratePercent}
                    onChange={(e) => setRatePercent(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    %
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  Tasa activa y disponible para asignar a productos
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[48px] px-5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
