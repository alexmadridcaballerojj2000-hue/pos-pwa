import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';
import { type CashMovement, type Minor, type CurrencyConfig } from '@/domain';
import { useI18n } from '@/app/i18n';
import { db } from '@/data/db';
import { useAuthStore } from '@/features/auth/auth-store';
import { addCashMovement } from './shift-operations';

export interface CashMovementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'in' | 'out';
  currency?: CurrencyConfig;
  onMovementAdded?: (movement: CashMovement) => void;
}

const REASON_PRESETS_IN = [
  'Aportación de cambio',
  'Cobro extraordinario',
  'Fondo adicional',
  'Ajuste de caja',
];

const REASON_PRESETS_OUT = [
  'Pago a proveedor',
  'Retiro a caja fuerte',
  'Gastos menores',
  'Pago de servicios',
  'Anticipo de sueldo',
];

export const CashMovementDialog: React.FC<CashMovementDialogProps> = ({
  isOpen,
  onClose,
  defaultType = 'in',
  currency = { code: 'MXN', decimals: 2, symbol: '$' },
  onMovementAdded,
}) => {
  const { t } = useI18n();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [type, setType] = useState<'in' | 'out'>(defaultType);
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amountText.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Por favor ingrese un importe válido mayor a 0.');
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Por favor especifique un motivo o concepto para el movimiento.');
      return;
    }

    if (!currentUser) {
      setError('Debe haber un usuario autenticado para registrar movimientos de caja.');
      return;
    }

    const divisor = Math.pow(10, currency.decimals);
    const amountMinor: Minor = Math.round(parsedAmount * divisor);

    try {
      setIsSubmitting(true);
      const movement = await addCashMovement(db, {
        cashierId: currentUser.id,
        type,
        amount: amountMinor,
        reason: trimmedReason,
      });

      if (onMovementAdded) {
        onMovementAdded(movement);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar el movimiento.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const presets = type === 'in' ? REASON_PRESETS_IN : REASON_PRESETS_OUT;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-movement-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-background border border-border shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                type === 'in'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {type === 'in' ? (
                <ArrowDownRight className="w-6 h-6" />
              ) : (
                <ArrowUpRight className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 id="cash-movement-title" className="text-xl font-bold tracking-tight">
                {t('shifts.cashMovement')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {type === 'in' ? t('shifts.cashIn') : t('shifts.cashOut')}
              </p>
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

        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => {
              setType('in');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
              type === 'in'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowDownRight className="w-4 h-4 text-emerald-500" />
            {t('shifts.cashIn')}
          </button>
          <button
            type="button"
            onClick={() => {
              setType('out');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
              type === 'out'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
            {t('shifts.cashOut')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="movement-amount-input" className="text-sm font-medium">
              {t('shifts.amount')} ({currency.symbol || currency.code})
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                {currency.symbol || '$'}
              </span>
              <input
                id="movement-amount-input"
                type="number"
                step="any"
                min="0.01"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0.00"
                className="w-full h-14 pl-10 pr-4 text-2xl font-bold rounded-xl border border-input bg-card focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="movement-reason-input" className="text-sm font-medium">
              {t('shifts.reason')}
            </label>
            <input
              id="movement-reason-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Pago a proveedor de refrescos"
              className="w-full h-11 px-3.5 rounded-xl border border-input bg-card focus:outline-none focus:ring-2 focus:ring-primary text-sm shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Conceptos habituales
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted/80 hover:bg-muted text-foreground border border-border transition-colors"
                >
                  {p}
                </button>
              ))}
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
              className={`min-h-[48px] px-6 py-2.5 rounded-xl font-semibold text-white shadow-md transition-colors flex items-center justify-center ${
                type === 'in'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting
                ? 'Registrando...'
                : type === 'in'
                  ? 'Registrar Entrada'
                  : 'Registrar Salida'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
