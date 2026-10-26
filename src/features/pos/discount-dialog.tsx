import React, { useState, useEffect, useMemo } from 'react';
import { X, Percent, DollarSign, ShieldAlert, Check, Trash2 } from 'lucide-react';
import type { Discount, Minor, User, CurrencyConfig } from '@/domain';
import { formatMoney } from '@/domain';
import { useI18n } from '@/app/i18n';
import { ManagerApprovalDialog } from '@/features/auth/manager-approval-dialog';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { checkDiscountRequiresApproval } from './pos-discounts';

export interface DiscountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  baseAmount: Minor;
  initialDiscount?: Discount;
  currency: CurrencyConfig;
  maxDiscountBp?: number;
  currentUser: User | null;
  onApplyDiscount: (discount: Discount) => void;
  onRemoveDiscount?: () => void;
  db?: AppDatabase;
}

export const DiscountDialog: React.FC<DiscountDialogProps> = ({
  isOpen,
  onClose,
  title,
  baseAmount,
  initialDiscount,
  currency,
  maxDiscountBp = 1000, // 10% default
  currentUser,
  onApplyDiscount,
  onRemoveDiscount,
  db = defaultDb,
}) => {
  const { t } = useI18n();

  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [percentVal, setPercentVal] = useState<string>('10');
  const [fixedVal, setFixedVal] = useState<string>('0');
  const [reason, setReason] = useState<string>('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<Discount | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialDiscount) {
        setType(initialDiscount.type);
        if (initialDiscount.type === 'percent') {
          setPercentVal(String(initialDiscount.value / 100));
        } else {
          setFixedVal(String(initialDiscount.value / Math.pow(10, currency.decimals)));
        }
        setReason(initialDiscount.reason ?? '');
      } else {
        setType('percent');
        setPercentVal('10');
        setFixedVal('0');
        setReason('');
      }
      setShowApprovalDialog(false);
      setPendingDiscount(null);
    }
  }, [isOpen, initialDiscount, currency.decimals]);

  // Calculate discount and after amount preview
  const currentDiscount: Discount | null = useMemo(() => {
    if (type === 'percent') {
      const pct = parseFloat(percentVal);
      if (isNaN(pct) || pct <= 0) return null;
      return {
        type: 'percent',
        value: Math.round(pct * 100), // convert to Bp
        reason: reason.trim() || undefined,
      };
    } else {
      const fixed = parseFloat(fixedVal);
      if (isNaN(fixed) || fixed <= 0) return null;
      const minor = Math.round(fixed * Math.pow(10, currency.decimals));
      return {
        type: 'fixed',
        value: Math.min(minor, baseAmount),
        reason: reason.trim() || undefined,
      };
    }
  }, [type, percentVal, fixedVal, reason, baseAmount, currency.decimals]);

  const preview = useMemo(() => {
    if (!currentDiscount) {
      return { discountAmount: 0, finalAmount: baseAmount };
    }

    const rawDiscountAmount =
      currentDiscount.type === 'percent'
        ? Math.round((baseAmount * currentDiscount.value) / 10000)
        : currentDiscount.value;
    const discountAmount = Math.min(rawDiscountAmount, baseAmount);

    return {
      discountAmount,
      finalAmount: Math.max(0, baseAmount - discountAmount),
    };
  }, [currentDiscount, baseAmount]);

  const approvalCheck = useMemo(() => {
    if (!currentDiscount) return { requiresApproval: false, effectiveBp: 0 };
    return checkDiscountRequiresApproval(currentDiscount, baseAmount, maxDiscountBp, currentUser);
  }, [currentDiscount, baseAmount, maxDiscountBp, currentUser]);

  const handleApplyClick = () => {
    if (!currentDiscount) return;

    if (approvalCheck.requiresApproval) {
      setPendingDiscount(currentDiscount);
      setShowApprovalDialog(true);
    } else {
      onApplyDiscount(currentDiscount);
      onClose();
    }
  };

  const handleManagerApprove = (managerId: string) => {
    if (pendingDiscount) {
      onApplyDiscount({
        ...pendingDiscount,
        approvedBy: managerId,
      });
    }
    setShowApprovalDialog(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discount-dialog-title"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      >
        <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 id="discount-dialog-title" className="font-bold text-base text-foreground">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground">
                Base: {formatMoney(baseAmount, currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setType('percent')}
                className={`min-h-[44px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'percent'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                <span>Porcentaje (%)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('fixed')}
                className={`min-h-[44px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'fixed'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>Monto Fijo ({currency.symbol || '$'})</span>
              </button>
            </div>

            {/* Input by type */}
            {type === 'percent' ? (
              <div className="space-y-2">
                <label
                  htmlFor="discount-percent-input"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Porcentaje de Descuento:
                </label>
                <div className="relative">
                  <input
                    id="discount-percent-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={percentVal}
                    onChange={(e) => setPercentVal(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl border border-input bg-background font-mono text-lg font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                    %
                  </span>
                </div>

                {/* Quick % chips */}
                <div className="flex gap-1.5 pt-1">
                  {[5, 10, 15, 20].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPercentVal(String(p))}
                      className="flex-1 min-h-[38px] rounded-lg border border-border bg-background text-xs font-bold hover:bg-muted transition-colors shadow-2xs"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label
                  htmlFor="discount-fixed-input"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Monto Fijo a Descontar:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                    {currency.symbol || '$'}
                  </span>
                  <input
                    id="discount-fixed-input"
                    type="number"
                    min="0"
                    step="0.10"
                    value={fixedVal}
                    onChange={(e) => setFixedVal(e.target.value)}
                    className="w-full h-12 pl-8 pr-3 rounded-xl border border-input bg-background font-mono text-lg font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Motivo / Razón */}
            <div className="space-y-1">
              <label
                htmlFor="discount-reason-input"
                className="text-xs font-semibold text-muted-foreground"
              >
                Motivo (opcional):
              </label>
              <input
                id="discount-reason-input"
                type="text"
                placeholder="Ej. Promoción, Cortesía, Mercancía dañada..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {/* Approval warning */}
            {approvalCheck.requiresApproval && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Este descuento supera el límite autorizado ({maxDiscountBp / 100}%). Se requerirá
                  aprobación de un gerente o dueño con PIN.
                </span>
              </div>
            )}

            {/* Calculation summary */}
            <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Descuento aplicado:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  -{formatMoney(preview.discountAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between text-foreground font-semibold pt-1 border-t border-border/50">
                <span>Total a pagar:</span>
                <span className="font-bold">{formatMoney(preview.finalAmount, currency)}</span>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
            {initialDiscount && onRemoveDiscount ? (
              <button
                type="button"
                onClick={() => {
                  onRemoveDiscount();
                  onClose();
                }}
                className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Quitar</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] px-4 rounded-xl border border-border bg-background text-sm font-semibold hover:bg-muted transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={!currentDiscount || preview.discountAmount === 0}
                onClick={handleApplyClick}
                className="min-h-[48px] px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
              >
                <Check className="h-4 w-4" />
                <span>{t('common.save')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manager Approval Modal */}
      <ManagerApprovalDialog
        isOpen={showApprovalDialog}
        onClose={() => setShowApprovalDialog(false)}
        onApprove={handleManagerApprove}
        requiredPermission="discount:override"
        reason={`Descuento de ${type === 'percent' ? percentVal + '%' : formatMoney(preview.discountAmount, currency)}`}
        db={db}
      />
    </>
  );
};
