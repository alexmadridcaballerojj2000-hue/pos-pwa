import React, { useState } from 'react';
import {
  X,
  Printer,
  Calendar,
  User as UserIcon,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import type { Sale, CurrencyConfig } from '@/domain';
import { formatMoney, formatQuantity } from '@/domain';
import { useI18n } from '@/app/i18n';

export interface SaleDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  cashierName?: string;
  customerName?: string;
  currency: CurrencyConfig;
  paymentMethodLabels?: Record<string, string>;
  onReprint?: (sale: Sale) => void | Promise<void>;
}

function formatDateString(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

export const SaleDetailDialog: React.FC<SaleDetailDialogProps> = ({
  isOpen,
  onClose,
  sale,
  cashierName,
  customerName,
  currency,
  paymentMethodLabels = {},
  onReprint,
}) => {
  const { t } = useI18n();
  const [isReprinting, setIsReprinting] = useState(false);

  if (!isOpen) return null;

  const handleReprintClick = async () => {
    if (!onReprint) return;
    try {
      setIsReprinting(true);
      await onReprint(sale);
    } finally {
      setIsReprinting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sale-detail-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="sale-detail-title"
                  className="font-bold text-lg text-foreground leading-tight"
                >
                  {t('sales.saleDetail')}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completada
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Folio: {sale.number}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{t('sales.date')}</span>
              </div>
              <p className="text-xs font-semibold text-foreground">
                {formatDateString(sale.completedAt)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <UserIcon className="h-3.5 w-3.5" />
                <span>{t('sales.cashier')}</span>
              </div>
              <p className="text-xs font-semibold text-foreground truncate">
                {cashierName || 'Cajero'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <UserIcon className="h-3.5 w-3.5" />
                <span>{t('checkout.customer')}</span>
              </div>
              <p className="text-xs font-semibold text-foreground truncate">
                {customerName || t('checkout.generalPublic')}
              </p>
            </div>
          </div>

          {/* Products Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 border-b border-border text-xs font-bold text-muted-foreground grid grid-cols-12 gap-2">
              <span className="col-span-6">Producto</span>
              <span className="col-span-2 text-right">Cant.</span>
              <span className="col-span-2 text-right">Precio</span>
              <span className="col-span-2 text-right">Total</span>
            </div>
            <div className="divide-y divide-border/50">
              {sale.lines.map((line) => (
                <div
                  key={line.lineId}
                  className="px-4 py-2.5 text-xs grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-6">
                    <p className="font-semibold text-foreground leading-snug">{line.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{line.sku}</p>
                    {line.note && (
                      <p className="text-[10px] text-muted-foreground italic mt-0.5">
                        Nota: {line.note}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 text-right font-mono">
                    {formatQuantity(line.qty, undefined, 'es-ES')}
                  </div>
                  <div className="col-span-2 text-right font-mono">
                    {formatMoney(line.unitPrice, currency)}
                  </div>
                  <div className="col-span-2 text-right font-bold font-mono">
                    {formatMoney(line.lineTotal, currency)}
                    {line.lineDiscount > 0 && (
                      <span className="block text-[10px] text-emerald-600 font-normal">
                        -{formatMoney(line.lineDiscount, currency)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Taxes Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payments breakdown */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-2">
                <CreditCard className="h-4 w-4" />
                <span>{t('checkout.paymentsApplied')}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {sale.payments.map((p) => {
                  const label = paymentMethodLabels[p.method] || p.method;
                  return (
                    <div key={p.id} className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">
                        {label} {p.reference ? `(${p.reference})` : ''}
                      </span>
                      <span className="font-bold font-mono">{formatMoney(p.amount, currency)}</span>
                    </div>
                  );
                })}
                {sale.change > 0 && (
                  <div className="flex justify-between items-center pt-1.5 border-t border-border/50 text-emerald-600 font-semibold">
                    <span>{t('checkout.change')}</span>
                    <span className="font-mono">{formatMoney(sale.change, currency)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Subtotal, tax, total */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('pos.subtotal')}</span>
                <span className="font-mono">{formatMoney(sale.totals.subtotal, currency)}</span>
              </div>
              {sale.totals.lineDiscounts > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>{t('pos.lineDiscount')}</span>
                  <span className="font-mono">
                    -{formatMoney(sale.totals.lineDiscounts, currency)}
                  </span>
                </div>
              )}
              {sale.totals.orderDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>{t('pos.orderDiscount')}</span>
                  <span className="font-mono">
                    -{formatMoney(sale.totals.orderDiscount, currency)}
                  </span>
                </div>
              )}
              {sale.totals.taxBreakdown?.map((tb, idx) => (
                <div key={idx} className="flex justify-between text-muted-foreground">
                  <span>Impuesto ({tb.rateBp / 100}%)</span>
                  <span className="font-mono">{formatMoney(tb.tax, currency)}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline pt-2 border-t border-border font-bold text-sm text-foreground">
                <span>{t('pos.total')}</span>
                <span className="text-base text-primary font-mono">
                  {formatMoney(sale.totals.total, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold text-foreground transition-colors"
          >
            {t('common.close')}
          </button>

          {onReprint && (
            <button
              type="button"
              onClick={handleReprintClick}
              disabled={isReprinting}
              className="min-h-[48px] px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>{isReprinting ? t('receipt.printing') : t('sales.reprint')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
