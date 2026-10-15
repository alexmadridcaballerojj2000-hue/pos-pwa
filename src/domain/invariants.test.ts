import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateSale, type CartItemInput } from './calculator';
import { allocate } from './money';
import { generateId } from './ids';

describe('SPEC §6.2 Invariantes de Dominio (fast-check ≥ 1000 casos)', () => {
  const taxRateIds = [generateId(), generateId(), generateId()];
  const taxRatesBp = [0, 1500, 2100]; // 0%, 15%, 21%

  // Generator for valid cart items
  const arbitraryCartItem = (index: number): fc.Arbitrary<CartItemInput> =>
    fc.record({
      lineId: fc.constant(`line-${index}-${generateId()}`),
      productId: fc.constant(generateId()),
      sku: fc.constant(`SKU-${index}`),
      name: fc.constant(`Product ${index}`),
      qty: fc.integer({ min: 100, max: 10_000 }), // 0.100 to 10.000 units
      unitPrice: fc.integer({ min: 100, max: 100_000 }), // $1.00 to $1000.00
      taxRateId: fc.constantFrom(...taxRateIds),
      taxRateBp: fc.constantFrom(...taxRatesBp),
      discount: fc.option(
        fc.oneof(
          fc.record({
            type: fc.constant('percent' as const),
            value: fc.integer({ min: 100, max: 5000 }), // 1% to 50%
          }),
          fc.record({
            type: fc.constant('fixed' as const),
            value: fc.integer({ min: 50, max: 5000 }), // up to $50.00
          }),
        ),
        { nil: undefined },
      ),
    });

  const arbitraryCart = fc
    .integer({ min: 1, max: 10 })
    .chain((count) => fc.tuple(...Array.from({ length: count }, (_, i) => arbitraryCartItem(i))));

  it('Invariante 1: allocate siempre suma estrictamente el total (1000 ejecuciones)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        fc.array(fc.integer({ min: 0, max: 500_000 }), { minLength: 1, maxLength: 30 }),
        (total, weights) => {
          const parts = allocate(total, weights);
          const sum = parts.reduce((acc, p) => acc + p, 0);
          expect(sum).toBe(total);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('Invariante 2: Σ orderDiscountShare estrictamente igual al descuento de orden aplicado (1000 ejecuciones)', () => {
    fc.assert(
      fc.property(
        arbitraryCart,
        fc.oneof(
          fc.record({
            type: fc.constant('percent' as const),
            value: fc.integer({ min: 100, max: 3000 }), // 1% to 30%
          }),
          fc.record({
            type: fc.constant('fixed' as const),
            value: fc.integer({ min: 100, max: 50_000 }),
          }),
        ),
        fc.boolean(),
        (items, orderDiscount, pricesIncludeTax) => {
          const sale = calculateSale(items, orderDiscount, pricesIncludeTax);
          const sumShares = sale.lines.reduce((acc, l) => acc + l.orderDiscountShare, 0);
          expect(sumShares).toBe(sale.totals.orderDiscount);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('Invariante 3: con impuesto incluido, net + tax ≡ taxableBase en cada línea (1000 ejecuciones)', () => {
    fc.assert(
      fc.property(arbitraryCart, (items) => {
        const sale = calculateSale(items, undefined, true);
        for (const line of sale.lines) {
          // In tax included, lineTotal === taxableBase
          expect(line.lineTotal).toBe(line.taxableBase);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('Invariante 4: total ≥ 0 y total ≡ Σ lineTotal + roundingAdjustment (1000 ejecuciones)', () => {
    fc.assert(
      fc.property(arbitraryCart, fc.boolean(), (items, pricesIncludeTax) => {
        const sale = calculateSale(items, undefined, pricesIncludeTax);
        expect(sale.totals.total).toBeGreaterThanOrEqual(0);
        const sumLineTotals = sale.lines.reduce((acc, l) => acc + l.lineTotal, 0);
        expect(sale.totals.total).toBe(sumLineTotals + sale.totals.roundingAdjustment);
      }),
      { numRuns: 1000 },
    );
  });

  it('Invariante 5: suma de impuestos en taxBreakdown ≡ totals.tax (1000 ejecuciones)', () => {
    fc.assert(
      fc.property(arbitraryCart, fc.boolean(), (items, pricesIncludeTax) => {
        const sale = calculateSale(items, undefined, pricesIncludeTax);
        const sumBreakdownTax = sale.totals.taxBreakdown.reduce((acc, t) => acc + t.tax, 0);
        expect(sumBreakdownTax).toBe(sale.totals.tax);
      }),
      { numRuns: 1000 },
    );
  });

  it('Invariante 6: El resultado de venta no depende del orden de las líneas (1000 ejecuciones)', () => {
    fc.assert(
      fc.property(arbitraryCart, fc.boolean(), (items, pricesIncludeTax) => {
        // Filter to items with distinct prices/taxes to test shuffling
        if (items.length < 2) return;

        const saleOriginal = calculateSale(items, undefined, pricesIncludeTax);

        // Reverse or shuffle
        const reversedItems = [...items].reverse();
        const saleReversed = calculateSale(reversedItems, undefined, pricesIncludeTax);

        expect(saleReversed.totals.subtotal).toBe(saleOriginal.totals.subtotal);
        expect(saleReversed.totals.lineDiscounts).toBe(saleOriginal.totals.lineDiscounts);
        expect(saleReversed.totals.orderDiscount).toBe(saleOriginal.totals.orderDiscount);
        expect(saleReversed.totals.total).toBe(saleOriginal.totals.total);
        expect(saleReversed.totals.tax).toBe(saleOriginal.totals.tax);
      }),
      { numRuns: 1000 },
    );
  });
});
