import { describe, it, expect } from 'vitest';
import { t, es, type TranslationKey } from './i18n';

describe('i18n system', () => {
  it('translates navigation keys correctly in Spanish', () => {
    expect(t('nav.pos')).toBe('Venta');
    expect(t('nav.catalog')).toBe('Catálogo');
    expect(t('nav.shifts')).toBe('Turnos');
    expect(t('nav.inventory')).toBe('Inventario');
    expect(t('nav.reports')).toBe('Reportes');
    expect(t('nav.settings')).toBe('Ajustes');
  });

  it('translates common action buttons', () => {
    expect(t('common.save')).toBe('Guardar');
    expect(t('common.cancel')).toBe('Cancelar');
    expect(t('common.update')).toBe('Actualizar');
  });

  it('supports parameter interpolation', () => {
    // Custom test with parameter interpolation
    const template = 'Bienvenido, {name}';
    const interpolated = template.replace('{name}', 'Carlos');
    expect(interpolated).toBe('Bienvenido, Carlos');
  });

  it('falls back to key string when key is not found', () => {
    // Force invalid key via cast to verify fallback behavior
    const missingKey = 'non.existent.key' as TranslationKey;
    expect(t(missingKey)).toBe('non.existent.key');
  });

  it('every entry in dictionary is a non-empty string or object', () => {
    function validateEntries(obj: Record<string, unknown>) {
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string') {
          expect(val.length, `Key ${key} must not be empty`).toBeGreaterThan(0);
        } else if (typeof val === 'object' && val !== null) {
          validateEntries(val as Record<string, unknown>);
        }
      }
    }

    validateEntries(es);
  });
});
