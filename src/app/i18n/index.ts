import { es } from './es';

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<typeof es>;

/**
 * Type-safe translation function.
 * Translates a dot-notated key to Spanish.
 *
 * @param key - Translation dot-path (e.g. 'nav.pos', 'pos.total')
 * @param params - Optional interpolation values (e.g. { name: 'Café' })
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let current: unknown = es;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }

  if (typeof current !== 'string') {
    return key;
  }

  let result = current;
  if (params) {
    for (const [paramKey, paramVal] of Object.entries(params)) {
      result = result.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramVal));
    }
  }

  return result;
}

export function useTranslation() {
  return { t };
}

export { es };
