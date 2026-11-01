import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Printer, X, CheckCircle2, PlusCircle, RefreshCw } from 'lucide-react';
import type { CurrencyConfig, Sale } from '@/domain';
import { buildReceiptDoc } from '@/domain';
import { printerService } from '@/hardware';
import { useI18n } from '@/app/i18n';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  business: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    footerText?: string;
  };
  currency: CurrencyConfig;
  cashierName?: string;
  customerName?: string;
  paymentMethodLabels?: Record<string, string>;
  initialPaperWidthMm?: 58 | 80;
  isReprint?: boolean;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  business,
  currency,
  cashierName,
  customerName,
  paymentMethodLabels = {},
  initialPaperWidthMm = 80,
  isReprint = false,
  onNewSale,
}) => {
  const { t } = useI18n();
  const [paperWidthMm, setPaperWidthMm] = useState<58 | 80>(initialPaperWidthMm);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Generate intermediate representation ReceiptDoc
  const receiptDoc = useMemo(() => {
    return buildReceiptDoc({
      sale,
      business,
      currency,
      cashierName,
      customerName,
      paymentMethodLabels,
      paperWidthMm,
      openDrawer: false,
      isReprint,
    });
  }, [
    sale,
    business,
    currency,
    cashierName,
    customerName,
    paymentMethodLabels,
    paperWidthMm,
    isReprint,
  ]);

  // Handle printing via printerService
  const handlePrint = useCallback(async () => {
    try {
      setIsPrinting(true);
      await printerService.print(receiptDoc);
    } catch (err) {
      console.error('Failed to print receipt:', err);
    } finally {
      setIsPrinting(false);
    }
  }, [receiptDoc]);

  // Keyboard navigation inside modal (Escape / Enter triggers onNewSale or close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onNewSale) {
          onNewSale();
        } else {
          onClose();
        }
      } else if (e.key === 'Enter') {
        // If Enter is pressed, user wants to continue to new sale
        e.preventDefault();
        if (onNewSale) {
          onNewSale();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onNewSale, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                isReprint
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600'
              }`}
            >
              {isReprint ? <RefreshCw className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <h2
                id="receipt-modal-title"
                className="font-bold text-base text-foreground leading-tight"
              >
                {isReprint ? 'Reimpresión de Recibo' : t('receipt.saleSuccess')}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">Folio: {sale.number}</p>
            </div>
          </div>

          {/* Width Toggle and Close */}
          <div className="flex items-center gap-2">
            <div className="flex p-0.5 bg-muted rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaperWidthMm(58)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  paperWidthMm === 58
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('receipt.width58')}
              </button>
              <button
                type="button"
                onClick={() => setPaperWidthMm(80)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  paperWidthMm === 80
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('receipt.width80')}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Ticket Content Preview */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-muted/30 flex justify-center">
          <div
            className={`bg-white text-black rounded-lg border border-neutral-300 shadow-md p-4 font-mono select-text transition-all ${
              paperWidthMm === 58 ? 'w-[280px] text-[11px]' : 'w-[360px] text-xs'
            }`}
          >
            {receiptDoc.blocks.map((block, idx) => {
              switch (block.type) {
                case 'pulse':
                  return null;
                case 'text': {
                  const alignClass =
                    block.align === 'center'
                      ? 'text-center'
                      : block.align === 'right'
                        ? 'text-right'
                        : 'text-left';
                  const sizeClass =
                    block.size === 'large'
                      ? 'text-sm font-bold my-1'
                      : block.size === 'small'
                        ? 'text-[10px] text-neutral-600'
                        : 'text-inherit';
                  return (
                    <div
                      key={idx}
                      className={`${alignClass} ${sizeClass} ${
                        block.bold ? 'font-bold' : ''
                      } leading-snug`}
                    >
                      {block.text}
                    </div>
                  );
                }
                case 'row':
                  return (
                    <div
                      key={idx}
                      className={`flex justify-between items-baseline my-0.5 ${
                        block.bold ? 'font-bold' : ''
                      }`}
                    >
                      <span className="truncate pr-2">{block.left}</span>
                      <span className="shrink-0">{block.right}</span>
                    </div>
                  );
                case 'divider':
                  return (
                    <div
                      key={idx}
                      className={`my-1.5 border-t ${
                        block.char === '='
                          ? 'border-double border-neutral-900 border-t-2'
                          : 'border-dashed border-neutral-500'
                      }`}
                    />
                  );
                case 'feed':
                  return <div key={idx} style={{ height: `${block.lines * 0.9}em` }} />;
                case 'barcode':
                  return (
                    <div
                      key={idx}
                      className="text-center font-bold tracking-widest my-2 text-xs border border-neutral-400 py-1 rounded bg-neutral-50"
                    >
                      *{block.data}*
                    </div>
                  );
                case 'qr':
                  return (
                    <div key={idx} className="text-center text-[10px] text-neutral-600 my-1">
                      [QR: {block.data}]
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="min-h-[48px] px-5 rounded-xl border border-border bg-background hover:bg-muted text-sm font-bold text-foreground flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            <span>{isPrinting ? t('receipt.printing') : t('receipt.print')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNewSale) {
                onNewSale();
              } else {
                onClose();
              }
            }}
            className="min-h-[48px] px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-98"
          >
            {isReprint ? <X className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
            <span>{isReprint ? t('common.close') : t('receipt.newSale')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
