import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatMoney, formatQuantity } from './format';

describe('formatMoney (SPEC §10 & §5)', () => {
  const usdConfig = { code: 'USD', decimals: 2, symbol: '$' };
  const eurConfig = { code: 'EUR', decimals: 2, symbol: '€' };
  const clpConfig = { code: 'CLP', decimals: 0, symbol: '$' };
  const bhdConfig = { code: 'BHD', decimals: 3, symbol: 'BD' };

  it('formats standard 2-decimal currency correctly in Spanish locale', () => {
    // 10.50 USD
    const result = formatMoney(1050, usdConfig, 'es-ES');
    expect(result).toContain('10,50');
    expect(result).toMatch(/US\$|\$|USD/);
  });

  it('formats zero minor amount correctly', () => {
    const result = formatMoney(0, usdConfig, 'es-ES');
    expect(result).toContain('0,00');
  });

  it('formats negative amounts correctly (for refunds/discounts)', () => {
    const result = formatMoney(-2500, eurConfig, 'es-ES');
    expect(result).toContain('-25,00');
  });

  it('formats zero-decimal currencies without decimal separator', () => {
    // 5000 CLP (no decimals)
    const result = formatMoney(5000, clpConfig, 'es-ES');
    expect(result).toContain('5000');
    expect(result).not.toContain(',');
  });

  it('formats 3-decimal currencies correctly', () => {
    // 1.250 BHD
    const result = formatMoney(1250, bhdConfig, 'es-ES');
    expect(result).toContain('1,250');
  });

  it('falls back cleanly for non-standard or custom currency code', () => {
    const customConfig = { code: 'CUSTOM', decimals: 2, symbol: 'Tokens' };
    const result = formatMoney(1500, customConfig, 'es-ES');
    expect(result).toContain('15,00');
    expect(result).toContain('Tokens');
  });

  it('property-based: any integer minor value formats without crashing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100_000_000, max: 100_000_000 }),
        fc.constantFrom(usdConfig, eurConfig, clpConfig),
        (minor, config) => {
          const formatted = formatMoney(minor, config, 'es-ES');
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('formatQuantity', () => {
  it('formats whole integer quantities without decimals', () => {
    // 2 units = 2000 milli
    expect(formatQuantity(2000, 'unidades', 'es-ES')).toBe('2 unidades');
  });

  it('formats fractional quantities with decimal places', () => {
    // 1.5 kg = 1500 milli
    expect(formatQuantity(1500, 'kg', 'es-ES')).toBe('1,5 kg');

    // 0.250 kg = 250 milli
    expect(formatQuantity(250, 'kg', 'es-ES')).toBe('0,25 kg');

    // 0.125 kg = 125 milli
    expect(formatQuantity(125, 'kg', 'es-ES')).toBe('0,125 kg');
  });

  it('formats without unit label when unit is omitted', () => {
    expect(formatQuantity(3000, undefined, 'es-ES')).toBe('3');
  });

  it('property-based: any positive milli quantity formats cleanly', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (milli) => {
        const formatted = formatQuantity(milli, 'kg', 'es-ES');
        expect(typeof formatted).toBe('string');
        expect(formatted).toContain('kg');
      }),
      { numRuns: 300 },
    );
  });
});
