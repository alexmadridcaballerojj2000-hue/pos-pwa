import React, { useState, useEffect } from 'react';
import { X, FileText, Check } from 'lucide-react';
import { useI18n } from '@/app/i18n';

export interface LineNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  initialNote?: string;
  onSave: (note?: string) => void;
}

export const LineNoteDialog: React.FC<LineNoteDialogProps> = ({
  isOpen,
  onClose,
  productName,
  initialNote = '',
  onSave,
}) => {
  const { t } = useI18n();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNote(initialNote);
    }
  }, [isOpen, initialNote]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = note.trim();
    onSave(trimmed ? trimmed : undefined);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-dialog-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 id="note-dialog-title" className="font-bold text-base text-foreground">
                {t('pos.note')}
              </h2>
              <p className="text-xs text-muted-foreground truncate max-w-[260px]">{productName}</p>
            </div>
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

        {/* Content */}
        <div className="p-5 space-y-3">
          <label htmlFor="line-note-input" className="text-xs font-semibold text-muted-foreground">
            Instrucciones especiales, número de serie o especificaciones:
          </label>
          <textarea
            id="line-note-input"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej. Sin cebolla, serie #A1249, para regalo..."
            className="w-full p-3 rounded-xl border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none placeholder:text-muted-foreground/60"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="px-5 py-4 bg-muted/30 border-t border-border flex items-center justify-between gap-3">
          {initialNote ? (
            <button
              type="button"
              onClick={() => {
                onSave(undefined);
                onClose();
              }}
              className="min-h-[44px] px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              {t('common.delete')}
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
              onClick={handleSave}
              className="min-h-[48px] px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-all shadow-sm"
            >
              <Check className="h-4 w-4" />
              <span>{t('common.save')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
