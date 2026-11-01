import React, { useState } from 'react';
import {
  X,
  Lock,
  Printer,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Calculator,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { type Minor, type Shift, type ShiftSummary, type CurrencyConfig } from '@/domain';
import { formatMoney } from '@/domain';
import { useI18n } from '@/app/i18n';
import { db } from '@/data/db';
import { useAuthStore } from '@/features/auth/auth-store';
import { closeShift, type CloseShiftResult } from './shift-operations';

export interface CloseShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expectedCash?: Minor;
  currency?: CurrencyConfig;
  onShiftClosed?: (result: CloseShiftResult) => void;
  onPrintZReport?: (shift: Shift, summary: ShiftSummary) => void | Promise<void>;
}

const COMMON_DENOMINATIONS = [
  { value: 1000, label: '$1,000' },
  { value: 500, label: '$500' },
  { value: 200, label: '$200' },
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 2, label: '$2' },
  { value: 1, label: '$1' },
];

export const CloseShiftDialog: React.FC<CloseShiftDialogProps> = ({
  isOpen,
  onClose,
  expectedCash = 0,
  currency = { code: 'MXN', decimals: 2, symbol: '$' },
  onShiftClosed,
  onPrintZReport,
}) => {
  const { t } = useI18n();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [isBlindCount, setIsBlindCount] = useState(true);
  const [showDenominations, setShowDenominations] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [manualCountText, setManualCountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CloseShiftResult | null>(null);

  if (!isOpen) return null;

  // Calculate total from denominations if any
  const denominationTotalMinor = Object.entries(counts).reduce((sum, [denom, count]) => {
    const denomVal = parseFloat(denom);
    const c = count || 0;
    const minorVal = denomVal * Math.pow(10, currency.decimals);
    return sum + minorVal * c;
  }, 0);

  const divisor = Math.pow(10, currency.decimals);

  const getCountedCashMinor = (): Minor => {
    if (showDenominations) {
      return denominationTotalMinor;
    }
    const parsed = parseFloat(manualCountText.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return -1;
    return Math.round(parsed * divisor);
  };

  const handleDenominationChange = (value: number, delta: number) => {
    setCounts((prev) => {
      const current = prev[value] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [value]: next };
    });
  };

  const handleDenominationInput = (value: number, rawVal: string) => {
    const count = parseInt(rawVal, 10);
    setCounts((prev) => ({
      ...prev,
      [value]: isNaN(count) || count < 0 ? 0 : count,
    }));
  };

  const handleSubmitClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const countedMinor = getCountedCashMinor();
    if (countedMinor < 0) {
      setError('Por favor ingrese un importe de efectivo válido.');
      return;
    }

    if (!currentUser) {
      setError('Debe haber un usuario autenticado para realizar el cierre de turno.');
      return;
    }

    try {
      setIsSubmitting(true);
      const closeRes = await closeShift(db, {
        cashierId: currentUser.id,
        countedCash: countedMinor,
      });

      setResult(closeRes);
      if (onShiftClosed) {
        onShiftClosed(closeRes);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cerrar el turno.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-shift-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-background border border-border shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 id="close-shift-title" className="text-xl font-bold tracking-tight">
                {result ? t('shifts.finalZReport') : t('shifts.closeShift')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {result
                  ? 'Resumen del arqueo y corte de caja'
                  : 'Arqueo de efectivo y reconciliación'}
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

        {!result ? (
          /* STEP 1: COUNT CASH */
          <form onSubmit={handleSubmitClose} className="space-y-5">
            {/* Blind count toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border">
              <div className="flex items-center gap-2">
                {isBlindCount ? (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Eye className="w-4 h-4 text-primary" />
                )}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider block">
                    {t('shifts.blindCount')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isBlindCount
                      ? 'El monto esperado está oculto para evitar sesgos.'
                      : `Esperado: ${formatMoney(expectedCash, currency)}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBlindCount(!isBlindCount)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-muted transition-colors"
              >
                {isBlindCount ? 'Mostrar' : 'Ocultar'}
              </button>
            </div>

            {/* Toggle denomination mode */}
            <div className="flex items-center justify-between">
              <label htmlFor="counted-cash-input" className="text-sm font-semibold">
                {t('shifts.countedCash')}
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!showDenominations && manualCountText) {
                    setManualCountText('');
                  }
                  setShowDenominations(!showDenominations);
                }}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Calculator className="w-3.5 h-3.5" />
                {showDenominations ? 'Ingresar total directo' : 'Desglose por billetes/monedas'}
                {showDenominations ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            {showDenominations ? (
              <div className="space-y-2 border border-border rounded-xl p-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {COMMON_DENOMINATIONS.map((d) => {
                    const count = counts[d.value] || 0;
                    return (
                      <div
                        key={d.value}
                        className="flex items-center justify-between p-2 rounded-lg bg-background border border-border text-sm"
                      >
                        <span className="font-semibold">{d.label}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDenominationChange(d.value, -1)}
                            className="w-7 h-7 rounded bg-muted hover:bg-muted/80 text-foreground font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={count === 0 ? '' : count}
                            onChange={(e) => handleDenominationInput(d.value, e.target.value)}
                            placeholder="0"
                            className="w-12 h-7 text-center font-bold text-xs rounded border border-input bg-card"
                          />
                          <button
                            type="button"
                            onClick={() => handleDenominationChange(d.value, 1)}
                            className="w-7 h-7 rounded bg-muted hover:bg-muted/80 text-foreground font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Total calculado:
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {formatMoney(denominationTotalMinor, currency)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                  {currency.symbol || '$'}
                </span>
                <input
                  id="counted-cash-input"
                  type="number"
                  step="any"
                  min="0"
                  value={manualCountText}
                  onChange={(e) => setManualCountText(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-14 pl-10 pr-4 text-2xl font-bold rounded-xl border border-input bg-card focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  autoFocus
                />
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-3">
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
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {isSubmitting ? 'Cerrando turno...' : t('shifts.confirmClose')}
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: RECONCILIATION RESULT */
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('shifts.openingFloat')}</span>
                <span className="font-semibold">
                  {formatMoney(result.shift.openingFloat, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('shifts.cashSales')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{formatMoney(result.summary.sales.cashSalesTotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('shifts.inflow')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{formatMoney(result.summary.movements.inTotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('shifts.outflow')}</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  -{formatMoney(result.summary.movements.outTotal, currency)}
                </span>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-base">
                <span className="font-bold">{t('shifts.expectedCash')}</span>
                <span className="font-bold">
                  {formatMoney(result.shift.expectedCash ?? 0, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-base">
                <span className="font-bold">{t('shifts.countedCash')}</span>
                <span className="font-bold">
                  {formatMoney(result.shift.countedCash ?? 0, currency)}
                </span>
              </div>

              {/* Difference Badge */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="font-bold text-sm uppercase tracking-wider">
                  {t('shifts.difference')}
                </span>
                <div>
                  {(result.shift.difference ?? 0) === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('shifts.balanced')}
                    </span>
                  ) : (result.shift.difference ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      +{formatMoney(result.shift.difference ?? 0, currency)} ({t('shifts.overage')})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {formatMoney(result.shift.difference ?? 0, currency)} ({t('shifts.shortage')})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              {onPrintZReport && (
                <button
                  type="button"
                  onClick={() => onPrintZReport(result.shift, result.summary)}
                  className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-xl border border-input bg-card hover:bg-muted font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {t('shifts.printReport')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-colors flex items-center justify-center"
              >
                Finalizar y Salir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
