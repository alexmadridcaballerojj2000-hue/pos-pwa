import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Phone, Mail, Building, MapPin } from 'lucide-react';
import type { Customer, CustomFieldDef } from '@/domain';
import { repositories } from '@/data/repositories';
import { CustomerDialog } from './customer-dialog';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const loadData = useCallback(
    async (isMountedRef?: () => boolean) => {
      const [custList, fieldDefs] = await Promise.all([
        repositories.customers.search(searchQuery),
        repositories.customFieldDefs.listByEntity('customer'),
      ]);

      if (!isMountedRef || isMountedRef()) {
        setCustomers(custList);
        setCustomFieldDefs(fieldDefs);
      }
    },
    [searchQuery],
  );

  useEffect(() => {
    let isMounted = true;
    loadData(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const handleSaveCustomer = async (customer: Customer) => {
    await repositories.customers.save(customer);
    await loadData();
  };

  const handleDeleteCustomer = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este cliente?')) {
      await repositories.customers.delete(id);
      await loadData();
    }
  };

  const handleNewCustomer = () => {
    setEditingCustomer(null);
    setIsDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Clientes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Directorio de clientes para ventas a crédito, facturación y seguimiento.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewCustomer}
          className="min-h-[48px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cliente por nombre, teléfono, RFC o correo..."
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 shadow-sm"
        />
      </div>

      {/* Customers List / Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Cliente</th>
              <th className="py-3 px-4">Contacto</th>
              <th className="py-3 px-4">Identificación Fiscal</th>
              <th className="py-3 px-4">Dirección</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                  <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    No se encontraron clientes
                  </p>
                  <p className="mt-1 text-slate-400">
                    Registra clientes para asociarlos a órdenes de venta o facturas.
                  </p>
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{c.name}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                    <div className="space-y-0.5">
                      {c.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {!c.phone && !c.email && <span className="text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {c.taxId ? (
                      <span className="inline-flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-400" />
                        {c.taxId}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {c.address ? (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditCustomer(c)}
                        className="min-h-[44px] min-w-[44px] p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center rounded-lg"
                        aria-label={`Editar ${c.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(c.id)}
                        className="min-h-[44px] min-w-[44px] p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center rounded-lg"
                        aria-label={`Eliminar ${c.name}`}
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

      {/* Customer Dialog */}
      <CustomerDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
        customFieldDefs={customFieldDefs}
      />
    </div>
  );
};
