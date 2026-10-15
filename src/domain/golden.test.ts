import { describe, it, expect } from 'vitest';
import { calculateLineTax } from './tax';
import { prorateOrderDiscount } from './discount';
import { mulDivRound } from './money';
import { calculateSale, type CartItemInput } from './calculator';
import { generateId } from './ids';

/**
 * CASOS DORADOS (Golden Test Cases) - SPEC §6.2
 *
 * ¿Qué son y para qué sirven?
 * En sistemas financieros y de Punto de Venta (POS), un "caso dorado" es un escenario
 * de cálculo real con entradas y salidas exactas precalculadas y congeladas.
 * Sirven como piedra angular de verdad matemática inmutable: garantizan que ningún cambio
 * futuro en el código altere el cálculo de impuestos, centavos, prorrateos o redondeos.
 */
describe('SPEC §6.2 Casos Dorados (Golden Test Cases)', () => {
  const taxRate15Id = generateId();
  const taxRate0Id = generateId();

  it('Caso Dorado 1: Impuesto incluido, 15 %: bruto 11500 -> net 10000, tax 1500', () => {
    const result = calculateLineTax(11500, 1500, true);
    expect(result.net).toBe(10000);
    expect(result.tax).toBe(1500);
    expect(result.lineTotal).toBe(11500);
    expect(result.net + result.tax).toBe(11500);
  });

  it('Caso Dorado 2: Impuesto incluido, 15 %: bruto 10000 -> net 8696, tax 1304', () => {
    // 10000 * 10000 / 11500 = 8695.652... -> redondeo half-up = 8696
    // tax = 10000 - 8696 = 1304
    const result = calculateLineTax(10000, 1500, true);
    expect(result.net).toBe(8696);
    expect(result.tax).toBe(1304);
    expect(result.lineTotal).toBe(10000);
    expect(result.net + result.tax).toBe(10000);
  });

  it('Caso Dorado 3: Impuesto excluido, 15 %: base 1099 -> tax 165 (164,85 redondeado)', () => {
    // 1099 * 1500 / 10000 = 164.85 -> redondeo half-up = 165
    const result = calculateLineTax(1099, 1500, false);
    expect(result.net).toBe(1099);
    expect(result.tax).toBe(165);
    expect(result.lineTotal).toBe(1264); // 1099 + 165
  });

  it('Caso Dorado 4: Prorrateo de orden: descuento 1000 sobre líneas [3333, 3333, 3334] -> [333, 333, 334]', () => {
    const shares = prorateOrderDiscount(1000, [3333, 3333, 3334]);
    expect(shares).toEqual([333, 333, 334]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('Caso Dorado 5: Exento (rateBp = 0): tax siempre 0', () => {
    const inc = calculateLineTax(7500, 0, true);
    expect(inc.tax).toBe(0);
    expect(inc.net).toBe(7500);
    expect(inc.lineTotal).toBe(7500);

    const exc = calculateLineTax(7500, 0, false);
    expect(exc.tax).toBe(0);
    expect(exc.net).toBe(7500);
    expect(exc.lineTotal).toBe(7500);
  });

  it('Caso Dorado 6: Cantidad fraccionaria: precio 2500 x 1,250 kg (qty 1250) -> lineBase 3125', () => {
    const lineBase = mulDivRound(2500, 1250, 1000);
    expect(lineBase).toBe(3125);
  });

  it('Caso Dorado 7: Venta multi-línea completa con descuento e impuestos mixtos', () => {
    const items: CartItemInput[] = [
      {
        lineId: generateId(),
        productId: generateId(),
        sku: 'A',
        name: 'Item A',
        qty: 1000, // 1 unit
        unitPrice: 11500,
        taxRateId: taxRate15Id,
        taxRateBp: 1500,
      },
      {
        lineId: generateId(),
        productId: generateId(),
        sku: 'B',
        name: 'Item B (Exento)',
        qty: 2000, // 2 units
        unitPrice: 2000,
        taxRateId: taxRate0Id,
        taxRateBp: 0,
      },
    ];

    const sale = calculateSale(items, undefined, true);

    expect(sale.totals.subtotal).toBe(15500); // 11500 + (2 * 2000)
    expect(sale.totals.lineDiscounts).toBe(0);
    expect(sale.totals.orderDiscount).toBe(0);
    expect(sale.totals.tax).toBe(1500); // Only item A has 1500 tax
    expect(sale.totals.total).toBe(15500);

    // Tax breakdown verification
    const tax15 = sale.totals.taxBreakdown.find((t) => t.taxRateId === taxRate15Id)!;
    const tax0 = sale.totals.taxBreakdown.find((t) => t.taxRateId === taxRate0Id)!;

    expect(tax15.base).toBe(10000);
    expect(tax15.tax).toBe(1500);
    expect(tax0.base).toBe(4000);
    expect(tax0.tax).toBe(0);
  });
});
