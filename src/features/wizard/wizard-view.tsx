import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Coins, Receipt, ShieldCheck, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { completeSetup, type SetupFormData } from './setup-service';

const wizardSchema = z
  .object({
    businessName: z.string().min(1, 'El nombre del negocio es requerido'),
    taxId: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    receiptFooter: z.string().optional(),
    currencyCode: z.string().min(2).max(4),
    currencySymbol: z.string().min(1),
    decimals: z.number().min(0).max(4),
    pricesIncludeTax: z.boolean(),
    taxName: z.string().min(1, 'El nombre del impuesto es requerido'),
    taxPercent: z.number().min(0).max(100),
    ownerName: z.string().min(1, 'El nombre del dueño es requerido'),
    ownerPin: z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos'),
    ownerPinConfirm: z.string().regex(/^\d{4,6}$/, 'Confirmación requerida'),
  })
  .refine((data) => data.ownerPin === data.ownerPinConfirm, {
    message: 'Los PIN ingresados no coinciden',
    path: ['ownerPinConfirm'],
  });

export type WizardFormValues = z.infer<typeof wizardSchema>;

interface WizardViewProps {
  onComplete?: () => void;
}

export const WizardView: React.FC<WizardViewProps> = ({ onComplete }) => {
  const { t } = useI18n();
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      businessName: '',
      taxId: '',
      address: '',
      phone: '',
      receiptFooter: '¡Gracias por su compra!',
      currencyCode: 'USD',
      currencySymbol: '$',
      decimals: 2,
      pricesIncludeTax: true,
      taxName: 'IVA 16%',
      taxPercent: 16,
      ownerName: '',
      ownerPin: '',
      ownerPinConfirm: '',
    },
    mode: 'onBlur',
  });

  const nextStep = async () => {
    let fieldsToValidate: (keyof WizardFormValues)[] = [];
    if (step === 1) fieldsToValidate = ['businessName'];
    if (step === 2) fieldsToValidate = ['currencyCode', 'currencySymbol', 'decimals'];
    if (step === 3) fieldsToValidate = ['taxName', 'taxPercent'];

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const onSubmit = async (values: WizardFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const data: SetupFormData = {
        businessName: values.businessName,
        taxId: values.taxId,
        address: values.address,
        phone: values.phone,
        receiptFooter: values.receiptFooter,
        currencyCode: values.currencyCode,
        currencySymbol: values.currencySymbol,
        decimals: values.decimals,
        pricesIncludeTax: values.pricesIncludeTax,
        taxName: values.taxName,
        taxPercent: values.taxPercent,
        ownerName: values.ownerName,
        ownerPin: values.ownerPin,
      };

      await completeSetup(data);
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 text-white p-6">
          <h1 className="text-2xl font-bold">{t('wizard.title')}</h1>
          <p className="text-emerald-100 text-sm mt-1">{t('wizard.subtitle')}</p>

          {/* Stepper indicator */}
          <div className="flex items-center justify-between mt-6 pt-2">
            {[
              { id: 1, label: t('wizard.step1'), icon: Building2 },
              { id: 2, label: t('wizard.step2'), icon: Coins },
              { id: 3, label: t('wizard.step3'), icon: Receipt },
              { id: 4, label: t('wizard.step4'), icon: ShieldCheck },
            ].map((s) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isPast = step > s.id;
              return (
                <div key={s.id} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                      isActive
                        ? 'bg-white text-emerald-700 shadow-md ring-4 ring-emerald-400/40'
                        : isPast
                          ? 'bg-emerald-800 text-white'
                          : 'bg-emerald-700/60 text-emerald-200'
                    }`}
                  >
                    {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className="text-xs mt-1.5 font-medium">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Business */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {t('wizard.businessName')}
              </h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('wizard.businessName')} *
                </label>
                <input
                  type="text"
                  {...register('businessName')}
                  placeholder={t('wizard.businessNamePlaceholder')}
                  className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 text-base"
                />
                {errors.businessName && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {errors.businessName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('wizard.taxId')}
                </label>
                <input
                  type="text"
                  {...register('taxId')}
                  placeholder={t('wizard.taxIdPlaceholder')}
                  className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.address')}
                  </label>
                  <input
                    type="text"
                    {...register('address')}
                    placeholder={t('wizard.addressPlaceholder')}
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.phone')}
                  </label>
                  <input
                    type="text"
                    {...register('phone')}
                    placeholder={t('wizard.phonePlaceholder')}
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('wizard.receiptFooter')}
                </label>
                <input
                  type="text"
                  {...register('receiptFooter')}
                  placeholder={t('wizard.receiptFooterPlaceholder')}
                  className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                />
              </div>
            </div>
          )}

          {/* Step 2: Currency */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {t('wizard.step2')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.currencyCode')}
                  </label>
                  <input
                    type="text"
                    {...register('currencyCode')}
                    placeholder="USD"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono text-base"
                  />
                  {errors.currencyCode && (
                    <p className="mt-1 text-xs text-rose-600">{errors.currencyCode.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.currencySymbol')}
                  </label>
                  <input
                    type="text"
                    {...register('currencySymbol')}
                    placeholder="$"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.decimals')}
                  </label>
                  <select
                    {...register('decimals', { valueAsNumber: true })}
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  >
                    <option value={2}>2 (Ej. 10.50)</option>
                    <option value={0}>0 (Ej. 10)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Taxes */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {t('wizard.step3')}
              </h2>

              <label className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  {...register('pricesIncludeTax')}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {t('wizard.pricesIncludeTax')}
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.taxRateName')}
                  </label>
                  <input
                    type="text"
                    {...register('taxName')}
                    placeholder="IVA 16%"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  />
                  {errors.taxName && (
                    <p className="mt-1 text-xs text-rose-600">{errors.taxName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.taxRateBp')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('taxPercent', { valueAsNumber: true })}
                    placeholder="16"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  />
                  {errors.taxPercent && (
                    <p className="mt-1 text-xs text-rose-600">{errors.taxPercent.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Owner */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {t('wizard.step4')}
              </h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('wizard.ownerName')} *
                </label>
                <input
                  type="text"
                  {...register('ownerName')}
                  placeholder="Administrador Principal"
                  className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                />
                {errors.ownerName && (
                  <p className="mt-1 text-xs text-rose-600">{errors.ownerName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.ownerPin')} *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    {...register('ownerPin')}
                    placeholder="••••"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                  />
                  {errors.ownerPin && (
                    <p className="mt-1 text-xs text-rose-600">{errors.ownerPin.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('wizard.ownerPinConfirm')} *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    {...register('ownerPinConfirm')}
                    placeholder="••••"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-xl tracking-widest font-mono"
                  />
                  {errors.ownerPinConfirm && (
                    <p className="mt-1 text-xs text-rose-600">{errors.ownerPinConfirm.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="min-h-[48px] px-5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                {t('wizard.back')}
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="min-h-[48px] px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 shadow-sm"
              >
                {t('wizard.next')}
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[48px] px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center gap-2 shadow-md"
              >
                {isSubmitting ? (
                  <span>{t('wizard.saving')}</span>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>{t('wizard.finish')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
