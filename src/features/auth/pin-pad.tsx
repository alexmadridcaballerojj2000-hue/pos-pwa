import React, { useEffect } from 'react';
import { Delete, RotateCcw } from 'lucide-react';

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  disabled?: boolean;
}

export const PinPad: React.FC<PinPadProps> = ({
  value,
  onChange,
  onSubmit,
  maxLength = 6,
  disabled = false,
}) => {
  const handleDigit = (digit: string) => {
    if (disabled || value.length >= maxLength) return;
    onChange(value + digit);
  };

  const handleBackspace = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      if (/^[0-9]$/.test(e.key)) {
        if (value.length < maxLength) {
          onChange(value + e.key);
        }
      } else if (e.key === 'Backspace') {
        if (value.length > 0) {
          onChange(value.slice(0, -1));
        }
      } else if (e.key === 'Escape') {
        onChange('');
      } else if (e.key === 'Enter') {
        if (value.length >= 4 && onSubmit) {
          onSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, disabled, maxLength, onChange, onSubmit]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'DEL'];

  return (
    <div className="flex flex-col items-center select-none w-full max-w-xs mx-auto">
      {/* PIN Dots Display */}
      <div className="flex justify-center items-center gap-3 mb-6 h-12" aria-label="PIN Digits">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150 ${
              i < value.length
                ? 'bg-emerald-600 dark:bg-emerald-400 scale-110 shadow-sm'
                : 'border-2 border-slate-300 dark:border-slate-700 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* 3x4 Grid */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {keys.map((key) => {
          const isClear = key === 'C';
          const isDel = key === 'DEL';

          let content: React.ReactNode = key;
          if (isClear) content = <RotateCcw className="w-6 h-6" />;
          if (isDel) content = <Delete className="w-6 h-6" />;

          const handleClick = () => {
            if (isClear) handleClear();
            else if (isDel) handleBackspace();
            else handleDigit(key);
          };

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={handleClick}
              className={`min-h-[56px] min-w-[56px] rounded-xl font-semibold text-xl flex items-center justify-center transition-all duration-100 active:scale-95 shadow-sm border ${
                isClear || isDel
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800 hover:border-emerald-500'
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
};
