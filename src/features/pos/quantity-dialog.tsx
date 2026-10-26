import React, { useState, useEffect, useCallback } from 'react';
import { X, Delete, Check } from 'lucide-react';
import type { Milli } from '@/domain';
import { useI18n } from '@/app/i18n';

export interface QuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  initialQtyMilli: Milli;
  allowFractional: boolean;
  unit?: string;
  onConfirm: (qtyMilli: Milli) => void;
}

export const QuantityDialog: React.FC<QuantityDialogProps> = ({
  isOpen,
  onClose,
  productName,
  initialQtyMilli,
  allowFractional,
  unit = 'unit',
  onConfirm,
}) => {
  const { t } = useI18n();
  const [valueStr, setValueStr] = useState<string>('1');

  useEffect(() => {
    if (isOpen) {
      const units = initialQtyMilli / 1000;
      setValueStr(String(units));
    }
  }, [isOpen, initialQtyMilli]);

  const handleDigit = useCallback((digit: string) => {
    setValueStr((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (digit === '.' && prev.includes('.')) return prev;
      // Limit max 3 decimals for milli precision
      if (prev.includes('.')) {
        const [, dec] = prev.split('.');
        if (dec && dec.length >= 3) return prev;
      }
      return prev + digit;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setValueStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  }, []);

  const handleClear = useCallback(() => {
    setValueStr('0');
  }, []);

  const handleQuickAdd = useCallback(
    (add: number) => {
      const current = parseFloat(valueStr) || 0;
      const next = Math.max(0, current + add);
      setValueStr(String(Number(next.toFixed(3))));
    },
    [valueStr],
  );

  const handleConfirm = useCallback(() => {
    const parsed = parseFloat(valueStr);
    if (!isNaN(parsed) && parsed > 0) {
      const qtyMilli = Math.round(parsed * 1000);
      onConfirm(qtyMilli);
      onClose();
    }
  }, [valueStr, onConfirm, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        if (allowFractional) {
          e.preventDefault();
          handleDigit('.');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allowFractional, onClose, handleConfirm, handleBackspace, handleDigit]);

  if (!isOpen) return null;

  const currentVal = parseFloat(valueStr) || 0;
  const isValid = currentVal > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qty-dialog-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 id="qty-dialog-title" className="font-bold text-base text-foreground">
              {t('pos.qty')} — {unit}
            </h2>
            <p className="text-xs text-muted-foreground truncate max-w-[220px]">{productName}</p>
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

        {/* Display */}
        <div className="p-4 bg-muted/40 border-b border-border text-center">
          <div
            data-testid="qty-display"
            className="font-mono text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-1"
          >
            <span>{valueStr}</span>
            <span className="text-sm font-sans font-medium text-muted-foreground">{unit}</span>
          </div>

          {/* Quick Add Chips */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {[1, 2, 5].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickAdd(amt)}
                className="min-h-[40px] px-3 py-1 rounded-lg bg-background border border-border text-xs font-semibold hover:bg-accent transition-colors shadow-2xs"
              >
                +{amt}
              </button>
            ))}
            {allowFractional && (
              <button
                type="button"
                onClick={() => handleQuickAdd(0.5)}
                className="min-h-[40px] px-3 py-1 rounded-lg bg-background border border-border text-xs font-semibold hover:bg-accent transition-colors shadow-2xs"
              >
                +0.5
              </button>
            )}
          </div>
        </div>

        {/* Numpad Grid */}
        <div className="p-4 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="min-h-[52px] rounded-xl bg-background border border-border text-lg font-bold hover:bg-muted active:scale-[0.98] transition-all shadow-2xs"
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: Decimal or Clear, 0, Backspace */}
          {allowFractional ? (
            <button
              type="button"
              onClick={() => handleDigit('.')}
              disabled={valueStr.includes('.')}
              className="min-h-[52px] rounded-xl bg-background border border-border text-xl font-bold hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-40 shadow-2xs"
            >
              .
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[52px] rounded-xl bg-background border border-border text-xs font-bold text-muted-foreground hover:bg-muted active:scale-[0.98] transition-all shadow-2xs"
            >
              C
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="min-h-[52px] rounded-xl bg-background border border-border text-lg font-bold hover:bg-muted active:scale-[0.98] transition-all shadow-2xs"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Borrar dígito"
            className="min-h-[52px] rounded-xl bg-background border border-border text-base font-bold flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.98] transition-all shadow-2xs"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] rounded-xl border border-border bg-background text-sm font-semibold hover:bg-muted transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={handleConfirm}
            className="min-h-[48px] rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
          >
            <Check className="h-4 w-4" />
            <span>{t('common.confirm')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
