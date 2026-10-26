import React, { useState } from 'react';
import { Clock, Play, Trash2, X, AlertCircle, ShoppingBag, User } from 'lucide-react';
import type { CurrencyConfig, HeldCart, UUID } from '@/domain';
import { formatMoney } from '@/domain';
import { useI18n } from '@/app/i18n';

export interface HeldCartsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  heldCarts: HeldCart[];
  currency: CurrencyConfig;
  customersMap?: Record<UUID, string>; // customerId -> customerName
  hasActiveCartItems: boolean;
  onResumeCart: (heldCart: HeldCart) => Promise<void> | void;
  onDiscardCart: (heldCartId: UUID) => Promise<void> | void;
}

export const HeldCartsDialog: React.FC<HeldCartsDialogProps> = ({
  isOpen,
  onClose,
  heldCarts,
  currency,
  customersMap = {},
  hasActiveCartItems,
  onResumeCart,
  onDiscardCart,
}) => {
  const { t } = useI18n();
  const [confirmResumeId, setConfirmResumeId] = useState<UUID | null>(null);

  if (!isOpen) return null;

  const handleResume = async (heldCart: HeldCart) => {
    if (hasActiveCartItems && confirmResumeId !== heldCart.id) {
      setConfirmResumeId(heldCart.id);
      return;
    }
    await onResumeCart(heldCart);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="held-carts-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 id="held-carts-title" className="text-base font-bold text-foreground">
                {t('pos.heldCarts')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {heldCarts.length === 1
                  ? '1 venta retenida'
                  : `${heldCarts.length} ventas retenidas`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conflict Alert if active cart has items */}
        {hasActiveCartItems && (
          <div className="p-3 mx-4 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t('pos.heldCartConflict')}</span>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {heldCarts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <ShoppingBag className="h-10 w-10 mx-auto stroke-1 text-muted-foreground/40" />
              <p className="text-sm font-semibold">{t('pos.noHeldCarts')}</p>
            </div>
          ) : (
            heldCarts.map((hc) => {
              const linesCount = Array.isArray(hc.lines) ? hc.lines.length : 0;
              const customerName = hc.customerId ? customersMap[hc.customerId] : undefined;
              const isConfirming = confirmResumeId === hc.id;

              // Calculate rough total from stored data or lines
              let totalMinor = 0;
              const anyHc = hc as unknown as { cartData?: { totals?: { total?: number } } };
              if (anyHc.cartData?.totals?.total !== undefined) {
                totalMinor = anyHc.cartData.totals.total;
              } else if (Array.isArray(hc.lines)) {
                totalMinor = (hc.lines as unknown[]).reduce<number>(
                  (acc: number, line: unknown) => {
                    const item = line as { unitPrice?: number; qty?: number };
                    if (typeof item.unitPrice === 'number' && typeof item.qty === 'number') {
                      return acc + Math.round((item.qty * item.unitPrice) / 1000);
                    }
                    return acc;
                  },
                  0,
                );
              }

              return (
                <div
                  key={hc.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isConfirming
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-border/80 bg-background hover:border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {hc.label || 'Venta retenida'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>
                          {new Date(hc.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          {linesCount} {linesCount === 1 ? t('pos.itemCount') : t('pos.itemsCount')}
                        </span>
                        {customerName && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-primary">
                              <User className="h-3 w-3" />
                              {customerName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {formatMoney(totalMinor, currency)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onDiscardCart(hc.id)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('pos.discardHeldCart')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResume(hc)}
                      className={`min-h-[44px] px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                        isConfirming
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{isConfirming ? 'Confirmar y reemplazar' : t('pos.resumeCart')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export interface HoldCartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmHold: (label?: string) => Promise<void> | void;
}

export const HoldCartDialog: React.FC<HoldCartDialogProps> = ({
  isOpen,
  onClose,
  onConfirmHold,
}) => {
  const { t } = useI18n();
  const [label, setLabel] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmHold(label.trim() || undefined);
    setLabel('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hold-cart-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-card text-card-foreground border border-border w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 id="hold-cart-title" className="text-base font-bold text-foreground">
              {t('pos.holdCart')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="hold-cart-label-input" className="text-xs font-bold text-foreground">
              {t('pos.holdCartLabel')}
            </label>
            <input
              id="hold-cart-label-input"
              type="text"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('pos.holdCartPlaceholder')}
              className="w-full h-11 px-3.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              {t('wizard.back')}
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors shadow-xs"
            >
              {t('pos.confirmHoldCart')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
