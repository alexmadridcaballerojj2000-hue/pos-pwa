import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  Send,
  Wallet,
  Check,
  Trash2,
  AlertCircle,
  Loader2,
  Delete,
} from 'lucide-react';
import type {
  CartState,
  CurrencyConfig,
  Minor,
  Payment,
  PaymentMethodConfig,
  UUID,
} from '@/domain';
import { formatMoney, v7, calculatePaymentSummary, validatePayment } from '@/domain';
import { useI18n } from '@/app/i18n';
import { getQuickCashOptions } from './quick-cash';

export interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartState;
  currency: CurrencyConfig;
  paymentMethods: PaymentMethodConfig[];
  customerName?: string;
  onCompleteSale: (params: {
    saleId: UUID;
    payments: Payment[];
    change: Minor;
  }) => Promise<void> | void;
}

export const CheckoutDialog: React.FC<CheckoutDialogProps> = ({
  isOpen,
  onClose,
  cart,
  currency,
  paymentMethods,
  customerName,
  onCompleteSale,
}) => {
  const { t } = useI18n();

  // Active payment methods
  const activeMethods = useMemo(() => paymentMethods.filter((m) => m.active), [paymentMethods]);

  const [selectedMethodId, setSelectedMethodId] = useState<string>(() => {
    const cash = activeMethods.find((m) => m.kind === 'cash');
    return cash?.id ?? activeMethods[0]?.id ?? '';
  });

  const selectedMethod = useMemo(
    () => activeMethods.find((m) => m.id === selectedMethodId) ?? activeMethods[0],
    [activeMethods, selectedMethodId],
  );

  // Payments applied so far (for split payments)
  const [payments, setPayments] = useState<Payment[]>([]);

  // Current amount input buffer (in major units string, e.g. "150.00")
  const [amountStr, setAmountStr] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Generate a client-side UUIDv7 saleId on dialog open for idempotency (Rule 6)
  const saleIdRef = useRef<UUID>(v7());
  const isSubmittingRef = useRef<boolean>(false);

  // Calculate current payment summary from applied payments
  const summary = useMemo(() => {
    return calculatePaymentSummary(cart.totals.total, payments);
  }, [cart.totals.total, payments]);

  const multiplier = useMemo(() => 10 ** currency.decimals, [currency.decimals]);

  // Convert current input string to Minor units
  const currentInputMinor = useMemo<Minor>(() => {
    const clean = amountStr.replace(',', '.').trim();
    if (!clean) return 0;
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * multiplier);
  }, [amountStr, multiplier]);

  // Quick cash denomination options for cash payments
  const quickCashOptions = useMemo(() => {
    if (selectedMethod?.kind !== 'cash' || summary.remainingDue <= 0) {
      return [];
    }
    return getQuickCashOptions(summary.remainingDue, currency);
  }, [selectedMethod?.kind, summary.remainingDue, currency]);

  // Reset / initialize state when opening dialog
  useEffect(() => {
    if (isOpen) {
      saleIdRef.current = v7();
      setPayments([]);
      setErrorMsg(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setReference('');
      const defaultMethod = activeMethods.find((m) => m.kind === 'cash') ?? activeMethods[0];
      if (defaultMethod) {
        setSelectedMethodId(defaultMethod.id);
      }
      const initialDueMajor = (cart.totals.total / multiplier).toFixed(currency.decimals);
      setAmountStr(initialDueMajor);
    }
  }, [isOpen, cart.totals.total, multiplier, currency.decimals, activeMethods]);

  // Update default amountStr when remainingDue changes
  const prevRemainingDueRef = useRef(summary.remainingDue);
  useEffect(() => {
    if (summary.remainingDue !== prevRemainingDueRef.current) {
      prevRemainingDueRef.current = summary.remainingDue;
      if (summary.remainingDue > 0) {
        setAmountStr((summary.remainingDue / multiplier).toFixed(currency.decimals));
      } else {
        setAmountStr('0');
      }
      setReference('');
      setErrorMsg(null);
    }
  }, [summary.remainingDue, multiplier, currency.decimals]);

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const getMethodIcon = (kind: string) => {
    switch (kind) {
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      case 'transfer':
        return <Send className="h-4 w-4" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  // Numpad button click handler
  const handleNumpadPress = (digit: string) => {
    setErrorMsg(null);
    if (digit === 'C') {
      setAmountStr('');
      return;
    }
    if (digit === 'DEL') {
      setAmountStr((prev) => prev.slice(0, -1));
      return;
    }
    if (digit === '.') {
      if (currency.decimals === 0) return;
      if (!amountStr.includes('.')) {
        setAmountStr((prev) => (prev ? prev + '.' : '0.'));
      }
      return;
    }
    // Limit decimal places
    const parts = amountStr.split('.');
    if (parts.length > 1 && parts[1] && parts[1].length >= currency.decimals) {
      return;
    }
    setAmountStr((prev) => (prev === '0' ? digit : prev + digit));
  };

  // Quick cash button click
  const handleQuickCash = (minorVal: Minor) => {
    setErrorMsg(null);
    setAmountStr((minorVal / multiplier).toFixed(currency.decimals));
  };

  // Add partial payment to split list
  const handleAddPayment = () => {
    if (!selectedMethod) return;
    setErrorMsg(null);

    const validation = validatePayment(
      currentInputMinor,
      summary.remainingDue,
      selectedMethod,
      reference,
    );

    if (!validation.valid) {
      if (validation.error === 'AMOUNT_NON_POSITIVE') {
        setErrorMsg(t('checkout.amountMustBePositive'));
      } else if (validation.error === 'REFERENCE_REQUIRED') {
        setErrorMsg(t('checkout.referenceRequired'));
      } else if (validation.error === 'NON_CASH_OVERPAYMENT') {
        setErrorMsg(t('checkout.nonCashOverpayment'));
      } else {
        setErrorMsg('Error de validación de pago');
      }
      return;
    }

    const appliedAmount =
      selectedMethod.kind === 'cash'
        ? Math.min(currentInputMinor, summary.remainingDue)
        : currentInputMinor;

    const newPayment: Payment = {
      id: v7(),
      method: selectedMethod.id,
      amount: appliedAmount,
      tendered: selectedMethod.kind === 'cash' ? currentInputMinor : undefined,
      reference: reference.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setPayments((prev) => [...prev, newPayment]);
  };

  // Remove a payment from list
  const handleRemovePayment = (paymentId: UUID) => {
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
  };

  // Submit and complete the sale
  const handleCompleteSale = async () => {
    if (isSubmitting || isSubmittingRef.current) return;
    setErrorMsg(null);

    let finalPayments = [...payments];

    // If remaining balance exists and user has entered an amount, validate and add it
    if (summary.remainingDue > 0) {
      if (!selectedMethod) {
        setErrorMsg(t('checkout.noPaymentMethods'));
        return;
      }

      const validation = validatePayment(
        currentInputMinor,
        summary.remainingDue,
        selectedMethod,
        reference,
      );

      if (!validation.valid) {
        if (validation.error === 'AMOUNT_NON_POSITIVE') {
          setErrorMsg(t('checkout.amountMustBePositive'));
        } else if (validation.error === 'REFERENCE_REQUIRED') {
          setErrorMsg(t('checkout.referenceRequired'));
        } else if (validation.error === 'NON_CASH_OVERPAYMENT') {
          setErrorMsg(t('checkout.nonCashOverpayment'));
        } else {
          setErrorMsg('Error de validación');
        }
        return;
      }

      const appliedAmount =
        selectedMethod.kind === 'cash'
          ? Math.min(currentInputMinor, summary.remainingDue)
          : currentInputMinor;

      const newPayment: Payment = {
        id: v7(),
        method: selectedMethod.id,
        amount: appliedAmount,
        tendered: selectedMethod.kind === 'cash' ? currentInputMinor : undefined,
        reference: reference.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      finalPayments = [...finalPayments, newPayment];
    }

    // Check if fully paid
    const finalSummary = calculatePaymentSummary(cart.totals.total, finalPayments);
    if (!finalSummary.isFullyPaid) {
      setErrorMsg(
        `Faltan ${formatMoney(finalSummary.remainingDue, currency)} para completar el pago.`,
      );
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      await onCompleteSale({
        saleId: saleIdRef.current,
        payments: finalPayments,
        change: finalSummary.change,
      });
    } catch (err) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar la venta');
    }
  };

  // Is ready to complete sale? (allow click when fully paid or when an amount is entered so validation messages appear)
  const canComplete = summary.isFullyPaid || (summary.remainingDue > 0 && currentInputMinor > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-dialog-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
          <div>
            <h2 id="checkout-dialog-title" className="font-bold text-lg text-foreground">
              {t('checkout.title')}
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{t('checkout.customer')}:</span>
              <span className="font-semibold text-foreground">
                {customerName ?? t('checkout.generalPublic')}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t('common.close')}
            className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Totals Summary Banner */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-xl border border-border/60 text-center">
            <div className="p-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                {t('checkout.totalToPay')}
              </span>
              <span className="text-base sm:text-lg font-bold text-foreground">
                {formatMoney(cart.totals.total, currency)}
              </span>
            </div>
            <div className="p-1 border-x border-border/60">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                {t('checkout.remainingDue')}
              </span>
              <span
                className={`text-base sm:text-lg font-bold ${
                  summary.remainingDue === 0
                    ? 'text-muted-foreground'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {formatMoney(summary.remainingDue, currency)}
              </span>
            </div>
            <div className="p-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                {t('checkout.change')}
              </span>
              <span
                className={`text-base sm:text-lg font-bold ${
                  summary.change > 0
                    ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                    : 'text-muted-foreground'
                }`}
              >
                {formatMoney(summary.change, currency)}
              </span>
            </div>
          </div>

          {/* Payments applied so far (if split) */}
          {payments.length > 0 && (
            <div className="space-y-2 border border-border/80 rounded-xl p-3 bg-background">
              <span className="text-xs font-semibold text-muted-foreground block">
                {`${t('checkout.paymentsApplied')} (${payments.length}):`}
              </span>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {payments.map((p) => {
                  const methodCfg = paymentMethods.find((m) => m.id === p.method);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {getMethodIcon(methodCfg?.kind ?? 'other')}
                        <span className="font-semibold text-foreground">
                          {methodCfg?.label ?? p.method}
                        </span>
                        {p.reference && (
                          <span className="text-[11px] text-muted-foreground">({p.reference})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-foreground">
                          {formatMoney(p.amount, currency)}
                        </span>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleRemovePayment(p.id)}
                          aria-label={`${t('checkout.removePayment')} ${methodCfg?.label ?? ''}`}
                          className="p-1.5 min-h-[36px] min-w-[36px] rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          {summary.remainingDue > 0 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  {t('checkout.paymentMethod')}:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeMethods.map((method) => {
                    const isSelected = method.id === selectedMethodId;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setSelectedMethodId(method.id);
                          setErrorMsg(null);
                        }}
                        className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary shadow-xs'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {getMethodIcon(method.kind)}
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reference input if required */}
              {selectedMethod?.requireReference && (
                <div className="space-y-1">
                  <label
                    htmlFor="payment-reference-input"
                    className="text-xs font-semibold text-foreground flex items-center gap-1"
                  >
                    <span>{t('checkout.reference')}:</span>
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="payment-reference-input"
                    type="text"
                    placeholder={t('checkout.referencePlaceholder')}
                    value={reference}
                    onChange={(e) => {
                      setReference(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              )}

              {/* Quick Cash Options for cash payments */}
              {selectedMethod?.kind === 'cash' && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    {t('checkout.quickCash')}:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {/* Exact option */}
                    <button
                      type="button"
                      onClick={() => handleQuickCash(summary.remainingDue)}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-primary/15 text-primary text-xs font-bold border border-primary/20 hover:bg-primary/25 transition-colors flex items-center gap-1.5"
                    >
                      <span>{t('checkout.exact')}:</span>
                      <span>{formatMoney(summary.remainingDue, currency)}</span>
                    </button>
                    {/* Bill denominations */}
                    {quickCashOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleQuickCash(opt)}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground hover:bg-muted/80 transition-colors"
                      >
                        {formatMoney(opt, currency)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Input and Touch Numpad */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                {/* Left: Input display & split payment action */}
                <div className="sm:col-span-7 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="payment-amount-input"
                      className="text-xs font-semibold text-muted-foreground block"
                    >
                      {t('checkout.tendered')}:
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                        {currency.symbol || '$'}
                      </span>
                      <input
                        id="payment-amount-input"
                        type="text"
                        inputMode="decimal"
                        value={amountStr}
                        onChange={(e) => {
                          setAmountStr(e.target.value);
                          setErrorMsg(null);
                        }}
                        className="w-full h-12 pl-8 pr-3 rounded-xl border border-input bg-background font-mono text-xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Split payment add button */}
                  {summary.remainingDue > 0 && (
                    <button
                      type="button"
                      disabled={currentInputMinor <= 0 || isSubmitting}
                      onClick={handleAddPayment}
                      className="min-h-[48px] w-full px-4 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <span>{t('checkout.addPayment')}</span>
                      <span className="text-muted-foreground">({t('checkout.splitPayment')})</span>
                    </button>
                  )}
                </div>

                {/* Right: Touch Numpad */}
                <div className="sm:col-span-5 grid grid-cols-3 gap-1.5 select-none">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={key === 'DEL' ? 'Borrar' : key}
                      onClick={() => handleNumpadPress(key)}
                      className="min-h-[48px] rounded-xl border border-border/80 bg-background hover:bg-muted text-base font-bold text-foreground flex items-center justify-center transition-colors active:scale-95"
                    >
                      {key === 'DEL' ? <Delete className="h-4 w-4" /> : key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Validation or submission error alert */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[48px] px-4 rounded-xl border border-border bg-background text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t('checkout.backToCart')}
          </button>

          <button
            type="button"
            disabled={!canComplete || isSubmitting}
            onClick={handleCompleteSale}
            className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-md active:scale-98"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('checkout.processing')}</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>{t('checkout.completeSale')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
