import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserCheck, X } from 'lucide-react';
import { generateId, type Customer, type CustomFieldDef } from '@/domain';
import { useI18n } from '@/app/i18n';
import { DynamicCustomFields } from '@/ui/dynamic-custom-fields';

const customerSchema = z.object({
  name: z.string().min(1, 'El nombre del cliente es obligatorio'),
  phone: z.string().optional(),
  email: z.string().email('Correo electrónico no válido').or(z.literal('')).optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void>;
  customer?: Customer | null;
  customFieldDefs?: CustomFieldDef[];
}

export const CustomerDialog: React.FC<CustomerDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  customer,
  customFieldDefs = [],
}) => {
  const { t } = useI18n();
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      taxId: '',
      address: '',
    },
  });

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        taxId: customer.taxId ?? '',
        address: customer.address ?? '',
      });
      setCustomValues(customer.custom || {});
    } else {
      reset({
        name: '',
        phone: '',
        email: '',
        taxId: '',
        address: '',
      });
      setCustomValues({});
    }
    setError(null);
  }, [customer, reset]);

  if (!isOpen) return null;

  const onSubmit = async (values: CustomerFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const nowIso = new Date().toISOString();
      const customerToSave: Customer = {
        id: customer ? customer.id : generateId(),
        name: values.name.trim(),
        phone: values.phone?.trim() || undefined,
        email: values.email?.trim() || undefined,
        taxId: values.taxId?.trim() || undefined,
        address: values.address?.trim() || undefined,
        custom: customValues,
        version: customer ? customer.version + 1 : 1,
        updatedAt: nowIso,
      };

      await onSave(customerToSave);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerCustomDefs = customFieldDefs.filter((d) => d.entity === 'customer');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Información para ventas, facturación y contacto.
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
          <div>
            <label
              htmlFor="customer-name-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nombre Completo / Razón Social *
            </label>
            <input
              id="customer-name-input"
              type="text"
              {...register('name')}
              placeholder="Juan Pérez o Empresa S.A."
              className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              autoFocus
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="customer-phone-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Teléfono de Contacto
              </label>
              <input
                id="customer-phone-input"
                type="tel"
                {...register('phone')}
                placeholder="+52 55 1234 5678"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="customer-email-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Correo Electrónico
              </label>
              <input
                id="customer-email-input"
                type="email"
                {...register('email')}
                placeholder="cliente@ejemplo.com"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="customer-taxid-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                RFC / Identificación Fiscal (Tax ID)
              </label>
              <input
                id="customer-taxid-input"
                type="text"
                {...register('taxId')}
                placeholder="XAXX010101000"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm uppercase"
              />
            </div>

            <div>
              <label
                htmlFor="customer-address-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Dirección / Domicilio
              </label>
              <input
                id="customer-address-input"
                type="text"
                {...register('address')}
                placeholder="Av. Principal #123, Col. Centro"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Dynamic Custom Fields */}
          {customerCustomDefs.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Datos Adicionales del Cliente
              </h3>
              <DynamicCustomFields
                defs={customerCustomDefs}
                values={customValues}
                onChange={setCustomValues}
              />
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
