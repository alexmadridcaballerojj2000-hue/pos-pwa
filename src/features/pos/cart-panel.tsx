import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  FileText,
  User,
  Percent,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import type { CartState, UUID, Milli, CurrencyConfig } from '@/domain';
import { formatMoney, formatQuantity } from '@/domain';
import { useI18n } from '@/app/i18n';
import { QuantityDialog } from './quantity-dialog';
import { LineNoteDialog } from './line-note-dialog';

export interface CartPanelProps {
  cart: CartState;
  currency: CurrencyConfig;
  onUpdateQty: (lineId: UUID, qty: Milli) => void;
  onRemoveItem: (lineId: UUID) => void;
  onSetLineNote: (lineId: UUID, note?: string) => void;
  onSetLineDiscount?: (lineId: UUID) => void;
  onSetOrderDiscount?: () => void;
  onSelectCustomer?: () => void;
  onClearCustomer?: () => void;
  onHoldCart?: () => void;
  onClearCart: () => void;
  onCheckout?: () => void;
  customerName?: string | null;
  heldCartsCount?: number;
  onOpenHeldCarts?: () => void;
  className?: string;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  currency,
  onUpdateQty,
  onRemoveItem,
  onSetLineNote,
  onSetLineDiscount,
  onSetOrderDiscount,
  onSelectCustomer,
  onHoldCart,
  onClearCart,
  onCheckout,
  customerName,
  onClearCustomer,
  heldCartsCount = 0,
  onOpenHeldCarts,
  className = '',
}) => {
  const { t } = useI18n();

  // Dialog states for editing line quantity and line note
  const [editingQtyLine, setEditingQtyLine] = useState<{
    lineId: UUID;
    productName: string;
    qty: Milli;
    allowFractional: boolean;
  } | null>(null);

  const [editingNoteLine, setEditingNoteLine] = useState<{
    lineId: UUID;
    productName: string;
    note?: string;
  } | null>(null);

  return (
    <div
      className={`flex flex-col h-full overflow-hidden border border-border rounded-2xl bg-card shadow-xs ${className}`}
    >
      {/* Top Header: Customer info & Cart actions */}
      <div className="p-3 border-b border-border shrink-0 flex items-center justify-between gap-2 bg-muted/20">
        {customerName ? (
          <div className="flex items-center gap-1 min-h-[44px] px-2.5 py-1 rounded-xl border border-primary/40 bg-primary/10 text-xs font-semibold text-primary max-w-[210px] shadow-2xs">
            <button
              type="button"
              onClick={onSelectCustomer}
              className="flex items-center gap-1.5 truncate flex-1 text-left min-h-[36px]"
              aria-label={`Cliente: ${customerName}`}
            >
              <User className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{customerName}</span>
            </button>
            {onClearCustomer && (
              <button
                type="button"
                onClick={onClearCustomer}
                className="p-1 hover:bg-primary/20 rounded-lg text-primary shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                aria-label={t('pos.removeCustomer')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onSelectCustomer}
            className="min-h-[44px] px-2.5 py-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted/60 flex items-center gap-2 text-xs font-semibold text-foreground max-w-[200px] truncate transition-colors shadow-2xs"
            aria-label={t('pos.selectCustomer')}
          >
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{t('pos.generalCustomer')}</span>
          </button>
        )}

        <div className="flex items-center gap-1.5">
          {onOpenHeldCarts && (
            <button
              type="button"
              onClick={onOpenHeldCarts}
              className="relative min-h-[44px] px-2.5 py-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted/60 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
              aria-label={t('pos.heldCarts')}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('pos.heldCarts')}</span>
              {heldCartsCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                  {heldCartsCount}
                </span>
              )}
            </button>
          )}

          {cart.items.length > 0 && (
            <>
              {onHoldCart && (
                <button
                  type="button"
                  onClick={onHoldCart}
                  className="min-h-[44px] px-2.5 py-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
                >
                  {t('pos.holdCart')}
                </button>
              )}
              <button
                type="button"
                onClick={onClearCart}
                className="min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Vaciar carrito"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cart Lines List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 stroke-1 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold">{t('pos.emptyCart')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Seleccione productos del catálogo o escanee un código de barras.
            </p>
          </div>
        ) : (
          cart.lines.map((line) => {
            const hasDiscount = !!line.discount;

            return (
              <div
                key={line.lineId}
                className="p-3 rounded-xl border border-border bg-background/80 hover:bg-background transition-colors flex flex-col gap-2 shadow-2xs"
              >
                {/* Product Name, SKU, and Total */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-foreground truncate">{line.name}</h4>
                    <p className="text-[11px] font-mono text-muted-foreground">{line.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-base text-foreground">
                      {formatMoney(line.lineTotal, currency)}
                    </span>
                    {hasDiscount && (
                      <p className="text-[11px] line-through text-muted-foreground">
                        {formatMoney(line.lineBase, currency)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Optional Note or Discount Tags */}
                {(line.note || hasDiscount) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {line.note && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingNoteLine({
                            lineId: line.lineId,
                            productName: line.name,
                            note: line.note,
                          })
                        }
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 max-w-[200px] truncate"
                      >
                        <FileText className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{line.note}</span>
                      </button>
                    )}
                    {hasDiscount && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Percent className="h-3 w-3" />
                        {line.discount?.type === 'percent'
                          ? `${line.discount.value / 100}%`
                          : `-${formatMoney(line.discount?.value ?? 0, currency)}`}
                      </span>
                    )}
                  </div>
                )}

                {/* Controls: Quantity stepper, Note, Discount, Delete */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                  {/* Quantity Stepper */}
                  <div className="flex items-center rounded-lg border border-border bg-muted/30">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.lineId, line.qty - 1000)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-l-lg transition-colors"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingQtyLine({
                          lineId: line.lineId,
                          productName: line.name,
                          qty: line.qty,
                          allowFractional: line.qty % 1000 !== 0,
                        })
                      }
                      className="min-h-[44px] px-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors font-mono"
                      aria-label={`Editar cantidad ${formatQuantity(line.qty)}`}
                    >
                      {formatQuantity(line.qty)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(line.lineId, line.qty + 1000)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-r-lg transition-colors"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Line actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingNoteLine({
                          lineId: line.lineId,
                          productName: line.name,
                          note: line.note,
                        })
                      }
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                      aria-label={line.note ? t('pos.editNote') : t('pos.addNote')}
                    >
                      <FileText className="h-4 w-4" />
                    </button>

                    {onSetLineDiscount && (
                      <button
                        type="button"
                        onClick={() => onSetLineDiscount(line.lineId)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                        aria-label={t('pos.lineDiscount')}
                      >
                        <Percent className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveItem(line.lineId)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                      aria-label={t('pos.removeLine')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Totals Section */}
      <div className="p-3 bg-muted/20 border-t border-border shrink-0 space-y-1.5 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>{t('pos.subtotal')}</span>
          <span className="font-mono">{formatMoney(cart.totals.subtotal, currency)}</span>
        </div>

        {cart.totals.lineDiscounts > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>{t('pos.lineDiscount')}</span>
            <span className="font-mono">-{formatMoney(cart.totals.lineDiscounts, currency)}</span>
          </div>
        )}

        {cart.totals.orderDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>{t('pos.orderDiscount')}</span>
            <span className="font-mono">-{formatMoney(cart.totals.orderDiscount, currency)}</span>
          </div>
        )}

        {/* Tax breakdown */}
        {cart.totals.taxBreakdown.map((tb) => (
          <div key={tb.taxRateId} className="flex justify-between text-muted-foreground">
            <span>
              {t('pos.tax')} ({tb.rateBp / 100}%)
            </span>
            <span className="font-mono">{formatMoney(tb.tax, currency)}</span>
          </div>
        ))}

        <div className="flex justify-between text-base font-bold text-foreground pt-1.5 border-t border-border/60">
          <span>{t('pos.total')}</span>
          <span className="text-primary font-mono text-lg">
            {formatMoney(cart.totals.total, currency)}
          </span>
        </div>

        {/* Global discount button */}
        {onSetOrderDiscount && (
          <button
            type="button"
            onClick={onSetOrderDiscount}
            disabled={cart.lines.length === 0}
            className="w-full min-h-[38px] text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
          >
            <Percent className="h-3 w-3" />
            <span>{t('pos.orderDiscount')}</span>
          </button>
        )}

        {/* Charge button */}
        <button
          type="button"
          disabled={cart.lines.length === 0}
          onClick={onCheckout}
          className="w-full min-h-[52px] mt-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.99] transition-all"
        >
          <span>{t('pos.charge')}</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Quantity Dialog */}
      {editingQtyLine && (
        <QuantityDialog
          isOpen={true}
          onClose={() => setEditingQtyLine(null)}
          productName={editingQtyLine.productName}
          initialQtyMilli={editingQtyLine.qty}
          allowFractional={editingQtyLine.allowFractional}
          onConfirm={(qty) => onUpdateQty(editingQtyLine.lineId, qty)}
        />
      )}

      {/* Line Note Dialog */}
      {editingNoteLine && (
        <LineNoteDialog
          isOpen={true}
          onClose={() => setEditingNoteLine(null)}
          productName={editingNoteLine.productName}
          initialNote={editingNoteLine.note}
          onSave={(note) => onSetLineNote(editingNoteLine.lineId, note)}
        />
      )}
    </div>
  );
};
