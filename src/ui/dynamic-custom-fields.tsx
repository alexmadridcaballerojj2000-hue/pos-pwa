import React from 'react';
import type { CustomFieldDef } from '@/domain';

interface DynamicCustomFieldsProps {
  defs: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export const DynamicCustomFields: React.FC<DynamicCustomFieldsProps> = ({
  defs,
  values,
  onChange,
  errors = {},
  disabled = false,
}) => {
  if (defs.length === 0) return null;

  const handleFieldChange = (key: string, value: unknown) => {
    onChange({
      ...values,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {defs.map((field) => {
          const inputId = `custom-field-${field.key}`;
          const val = values[field.key];
          const error = errors[field.key];

          return (
            <div key={field.id} className="space-y-1">
              <label
                htmlFor={inputId}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {field.label} {field.required && <span className="text-rose-500">*</span>}
              </label>

              {/* Text input */}
              {field.type === 'text' && (
                <input
                  id={inputId}
                  type="text"
                  value={val !== undefined && val !== null ? String(val) : ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  disabled={disabled}
                  required={field.required}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                />
              )}

              {/* Number input */}
              {field.type === 'number' && (
                <input
                  id={inputId}
                  type="number"
                  value={val !== undefined && val !== null ? String(val) : ''}
                  onChange={(e) =>
                    handleFieldChange(
                      field.key,
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                  disabled={disabled}
                  required={field.required}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                />
              )}

              {/* Date input */}
              {field.type === 'date' && (
                <input
                  id={inputId}
                  type="date"
                  value={val !== undefined && val !== null ? String(val) : ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  disabled={disabled}
                  required={field.required}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                />
              )}

              {/* Select input */}
              {field.type === 'select' && (
                <select
                  id={inputId}
                  value={val !== undefined && val !== null ? String(val) : ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  disabled={disabled}
                  required={field.required}
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">(Seleccione una opción)</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {/* Boolean toggle input */}
              {field.type === 'bool' && (
                <div className="flex items-center min-h-[44px]">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                      disabled={disabled}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                    />
                    <span>{field.label}</span>
                  </label>
                </div>
              )}

              {error && <p className="text-xs text-rose-600">{error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
