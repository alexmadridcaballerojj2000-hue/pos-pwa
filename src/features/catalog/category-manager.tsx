import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Folder, FolderTree, ChevronRight } from 'lucide-react';
import { generateId, type Category } from '@/domain';
import { useI18n } from '@/app/i18n';
import { getDescendantIds } from './category-utils';

interface CategoryManagerProps {
  categories: Category[];
  onSave: (category: Category) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  onSave,
  onDelete,
}) => {
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const openNewModal = (initialParentId?: string) => {
    setEditingCategory(null);
    setName('');
    setParentId(initialParentId ?? '');
    setSortOrder(categories.length + 1);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setParentId(cat.parentId ?? '');
    setSortOrder(cat.sort);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('El nombre de la categoría es obligatorio');
      return;
    }

    if (editingCategory) {
      if (parentId === editingCategory.id) {
        setError('Una categoría no puede ser su propio padre');
        return;
      }
      const descendants = getDescendantIds(editingCategory.id, categories);
      if (parentId && descendants.has(parentId)) {
        setError(
          'No se puede seleccionar una subcategoría descendiente como padre (crearía un ciclo)',
        );
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const catToSave: Category = {
      id: editingCategory ? editingCategory.id : generateId(),
      name: trimmed,
      parentId: parentId ? parentId : null,
      sort: sortOrder,
      version: editingCategory ? editingCategory.version + 1 : 1,
      updatedAt: nowIso,
    };

    try {
      await onSave(catToSave);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar categoría');
    }
  };

  // Build tree hierarchy
  const rootCategories = categories
    .filter((c) => !c.parentId || !categories.some((parent) => parent.id === c.parentId))
    .sort((a, b) => a.sort - b.sort);

  const getSubcategories = (parentCatId: string) =>
    categories.filter((c) => c.parentId === parentCatId).sort((a, b) => a.sort - b.sort);

  const invalidParentIds = editingCategory
    ? new Set([editingCategory.id, ...getDescendantIds(editingCategory.id, categories)])
    : new Set<string>();

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-emerald-600" />
            Categorías Jerárquicas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organiza tus productos en niveles jerárquicos para navegar y filtrar rápidamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openNewModal()}
          className="min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </button>
      </div>

      {/* Category Tree / List */}
      {rootCategories.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Folder className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No hay categorías registradas
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Crea tu primera categoría para clasificar tus productos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rootCategories.map((root) => {
            const subcategories = getSubcategories(root.id);
            return (
              <div
                key={root.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm"
              >
                {/* Root Category Row */}
                <div className="flex items-center justify-between p-4 bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {root.name}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                          Orden: {root.sort}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {subcategories.length}{' '}
                        {subcategories.length === 1 ? 'subcategoría' : 'subcategorías'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openNewModal(root.id)}
                      className="min-h-[44px] px-3 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-semibold flex items-center gap-1"
                      title="Agregar subcategoría"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Subcategoría
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(root)}
                      className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                      aria-label={`Editar ${root.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(root.id)}
                      className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center"
                      aria-label={`Eliminar ${root.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subcategories (Level 2) */}
                {subcategories.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pl-8 pr-4">
                    {subcategories.map((sub) => {
                      const level3 = getSubcategories(sub.id);
                      return (
                        <div key={sub.id} className="py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {sub.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                Orden: {sub.sort}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(sub)}
                                className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center"
                                aria-label={`Editar ${sub.name}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(sub.id)}
                                className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-rose-400 hover:text-rose-600 flex items-center justify-center"
                                aria-label={`Eliminar ${sub.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Level 3 (if any) */}
                          {level3.length > 0 && (
                            <div className="pl-6 pt-1 space-y-1">
                              {level3.map((l3) => (
                                <div
                                  key={l3.id}
                                  className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-400 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    <span>{l3.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(l3)}
                                      className="min-h-[44px] min-w-[44px] p-1.5 text-slate-400 hover:text-slate-600 flex items-center justify-center"
                                      aria-label={`Editar ${l3.name}`}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDelete(l3.id)}
                                      className="min-h-[44px] min-w-[44px] p-1.5 text-rose-400 hover:text-rose-600 flex items-center justify-center"
                                      aria-label={`Eliminar ${l3.name}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Category Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="cat-name-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nombre de la Categoría *
                </label>
                <input
                  id="cat-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Bebidas Frías"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="cat-parent-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Categoría Padre (Jerarquía)
                </label>
                <select
                  id="cat-parent-select"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="">(Ninguna - Nivel Principal)</option>
                  {categories
                    .filter((c) => !invalidParentIds.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cat-sort-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Orden de Visualización
                </label>
                <input
                  id="cat-sort-input"
                  type="number"
                  min="1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                />
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
