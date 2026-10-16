import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Sliders, Tag } from 'lucide-react';
import { generateId, type CustomFieldDef } from '@/domain';
import { useI18n } from '@/app/i18n';

interface CustomFieldManagerProps {
  customFieldDefs: CustomFieldDef[];
  onSave: (def: CustomFieldDef) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const CustomFieldManager: React.FC<CustomFieldManagerProps> = ({
  customFieldDefs,
  onSave,
  onDelete,
}) => {
  const { t } = useI18n();
  const [selectedEntity, setSelectedEntity] = useState<'product' | 'customer' | 'sale'>('product');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<CustomFieldDef | null>(null);

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'text' | 'number' | 'select' | 'bool' | 'date'>('text');
  const [optionsStr, setOptionsStr] = useState('');
  const [required, setRequired] = useState(false);
  const [showOnForm, setShowOnForm] = useState(true);
  const [showOnPos, setShowOnPos] = useState(true);
  const [showOnReceipt, setShowOnReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredDefs = customFieldDefs.filter((d) => d.entity === selectedEntity);

  const openNewModal = () => {
    setEditingDef(null);
    setKey('');
    setLabel('');
    setType('text');
    setOptionsStr('');
    setRequired(false);
    setShowOnForm(true);
    setShowOnPos(true);
    setShowOnReceipt(false);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (def: CustomFieldDef) => {
    setEditingDef(def);
    setKey(def.key);
    setLabel(def.label);
    setType(def.type);
    setOptionsStr(def.options ? def.options.join(', ') : '');
    setRequired(def.required);
    setShowOnForm(def.showOn.includes('form'));
    setShowOnPos(def.showOn.includes('pos'));
    setShowOnReceipt(def.showOn.includes('receipt'));
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    const cleanLabel = label.trim();

    if (!cleanKey) {
      setError('La clave interna (key) es requerida');
      return;
    }
    if (!cleanLabel) {
      setError('La etiqueta legible es requerida');
      return;
    }

    // Check key duplicate within the same entity
    const duplicate = customFieldDefs.find(
      (d) => d.entity === selectedEntity && d.key === cleanKey && d.id !== editingDef?.id,
    );
    if (duplicate) {
      setError(`Ya existe un campo con la clave "${cleanKey}" para esta entidad`);
      return;
    }

    let parsedOptions: string[] | undefined = undefined;
    if (type === 'select') {
      parsedOptions = optionsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parsedOptions.length === 0) {
        setError('Debe especificar al menos una opción para el tipo lista');
        return;
      }
    }

    const showOn: ('form' | 'pos' | 'receipt')[] = [];
    if (showOnForm) showOn.push('form');
    if (showOnPos) showOn.push('pos');
    if (showOnReceipt) showOn.push('receipt');

    const nowIso = new Date().toISOString();
    const defToSave: CustomFieldDef = {
      id: editingDef ? editingDef.id : generateId(),
      entity: selectedEntity,
      key: cleanKey,
      label: cleanLabel,
      type,
      options: parsedOptions,
      required,
      showOn,
      version: editingDef ? editingDef.version + 1 : 1,
      updatedAt: nowIso,
    };

    try {
      await onSave(defToSave);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar campo');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Entity Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600" />
            Campos Personalizados Dinámicos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Extiende productos, clientes y ventas con atributos propios de tu negocio.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Campo
        </button>
      </div>

      {/* Entity Tabs */}
      <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit">
        <button
          type="button"
          onClick={() => setSelectedEntity('product')}
          className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors ${
            selectedEntity === 'product'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Productos
        </button>
        <button
          type="button"
          onClick={() => setSelectedEntity('customer')}
          className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors ${
            selectedEntity === 'customer'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Clientes
        </button>
        <button
          type="button"
          onClick={() => setSelectedEntity('sale')}
          className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors ${
            selectedEntity === 'sale'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Ventas
        </button>
      </div>

      {/* Fields List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Etiqueta</th>
              <th className="py-3 px-4">Clave (Key)</th>
              <th className="py-3 px-4">Tipo</th>
              <th className="py-3 px-4">Obligatorio</th>
              <th className="py-3 px-4">Visualización</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {filteredDefs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                  No hay campos personalizados para {selectedEntity}.
                </td>
              </tr>
            ) : (
              filteredDefs.map((def) => (
                <tr key={def.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {def.label}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{def.key}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {def.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {def.required ? (
                      <span className="text-rose-600 font-semibold text-xs">Requerido</span>
                    ) : (
                      <span className="text-slate-400 text-xs">Opcional</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {def.showOn.map((target) => (
                        <span
                          key={target}
                          className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium"
                        >
                          {target}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(def)}
                        className="min-h-[44px] min-w-[44px] p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center rounded-lg"
                        aria-label={`Editar ${def.label}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(def.id)}
                        className="min-h-[44px] min-w-[44px] p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center rounded-lg"
                        aria-label={`Eliminar ${def.label}`}
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

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingDef ? 'Editar Campo Personalizado' : 'Nuevo Campo Personalizado'}
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="field-label-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Etiqueta Visible (Label) *
                </label>
                <input
                  id="field-label-input"
                  type="text"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (!editingDef) {
                      setKey(
                        e.target.value
                          .toLowerCase()
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^a-z0-9]/g, '_')
                          .slice(0, 32),
                      );
                    }
                  }}
                  placeholder="ej. Número de Serie"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="field-key-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Clave Interna (JSON key) *
                </label>
                <input
                  id="field-key-input"
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="ej. serial_number"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="field-type-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Tipo de Dato *
                </label>
                <select
                  id="field-type-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="text">Texto</option>
                  <option value="number">Numérico</option>
                  <option value="select">Lista de Selección (Dropdown)</option>
                  <option value="bool">Casilla Sí / No (Booleano)</option>
                  <option value="date">Fecha</option>
                </select>
              </div>

              {type === 'select' && (
                <div>
                  <label
                    htmlFor="field-options-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Opciones (separadas por coma) *
                  </label>
                  <input
                    id="field-options-input"
                    type="text"
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    placeholder="Rojo, Azul, Verde, Negro"
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  Campo obligatorio
                </label>

                <div className="pt-2">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mostrar en:
                  </span>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={showOnForm}
                        onChange={(e) => setShowOnForm(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600"
                      />
                      Formulario
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={showOnPos}
                        onChange={(e) => setShowOnPos(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600"
                      />
                      Terminal POS
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={showOnReceipt}
                        onChange={(e) => setShowOnReceipt(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600"
                      />
                      Ticket / Recibo
                    </label>
                  </div>
                </div>
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
