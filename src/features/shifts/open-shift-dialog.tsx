import React, { useState } from 'react';
import { X, DollarSign, AlertCircle } from 'lucide-react';
import { type Minor, type Shift, type CurrencyConfig } from '@/domain';
import { formatMoney } from '@/domain';
import { useI18n } from '@/app/i18n';
import { db } from '@/data/db';
import { useAuthStore } from '@/features/auth/auth-store';
import { openShift } from './shift-operations';

export interface OpenShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: CurrencyConfig;
  onShiftOpened?: (shift: Shift) => void;
}

const QUICK_FLOATS: number[] = [0, 200, 500, 1000, 2000];

export const OpenShiftDialog: React.FC<OpenShiftDialogProps> = ({
  isOpen,
  onClose,
  currency = { code: 'MXN', decimals: 2, symbol: '$' },
  onShiftOpened,
}) => {
  const { t } = useI18n();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [floatText, setFloatText] = useState('500');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectQuickFloat = (val: number) => {
    setFloatText(val.toString());
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedNum = parseFloat(floatText.replace(',', '.'));
    if (isNaN(parsedNum) || parsedNum < 0) {
      setError('Por favor ingrese un fondo inicial válido (mayor o igual a 0).');
      return;
    }

    if (!currentUser) {
      setError('Debe haber un usuario autenticado para abrir el turno.');
      return;
    }

    const divisor = Math.pow(10, currency.decimals);
    const openingFloatMinor: Minor = Math.round(parsedNum * divisor);

    try {
      setIsSubmitting(true);
      const shift = await openShift(db, {
        cashierId: currentUser.id,
        openingFloat: openingFloatMinor,
      });
      if (onShiftOpened) {
        onShiftOpened(shift);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al abrir el turno.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-shift-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-background border border-border shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 id="open-shift-title" className="text-xl font-bold tracking-tight">
                {t('shifts.openShift')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('shifts.openingFloat')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="opening-float-input" className="text-sm font-medium">
              {t('shifts.openingFloat')} ({currency.symbol || currency.code})
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                {currency.symbol || '$'}
              </span>
              <input
                id="opening-float-input"
                type="number"
                step="any"
                min="0"
                value={floatText}
                onChange={(e) => setFloatText(e.target.value)}
                placeholder="0.00"
                className="w-full h-14 pl-10 pr-4 text-2xl font-bold rounded-xl border border-input bg-card focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Importes rápidos
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_FLOATS.map((val) => {
                const minor = val * Math.pow(10, currency.decimals);
                const isSelected = floatText === val.toString();
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectQuickFloat(val)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted/70 hover:bg-muted text-foreground border border-border'
                    }`}
                  >
                    {formatMoney(minor, currency)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-input bg-background hover:bg-muted font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-colors flex items-center justify-center"
            >
              {isSubmitting ? 'Abriendo...' : t('shifts.openShift')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
