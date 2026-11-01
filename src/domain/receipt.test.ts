import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { buildReceiptDoc, renderReceiptToHtml } from './receipt';
import type { Sale, CurrencyConfig } from './index';
import { DEFAULT_CURRENCY, formatMoney, v7 } from './index';

describe('Receipt Engine & Thermal HTML Renderer (S5-T3)', () => {
  const sampleBusiness = {
    name: 'Abarrotes Don Pepe',
    taxId: 'PEPA900101XYZ',
    address: 'Av. Revolución #456, Col. Centro',
    phone: '+52 55 1234 5678',
    footerText: '¡Gracias por su preferencia!',
  };

  const sampleSale: Sale = {
    id: v7(),
    number: 'L01-000123',
    deviceId: v7(),
    shiftId: v7(),
    cashierId: v7(),
    customerId: v7(),
    status: 'completed',
    lines: [
      {
        lineId: v7(),
        productId: v7(),
        sku: 'SKU-001',
        name: 'Refresco Cola 600ml',
        qty: 2000, // 2 units
        unitPrice: 1800, // $18.00
        taxRateId: v7(),
        taxRateBp: 1600,
        lineBase: 3600,
        lineDiscount: 0,
        orderDiscountShare: 0,
        taxableBase: 3600,
        tax: 576,
        lineTotal: 3600,
        custom: {},
      },
      {
        lineId: v7(),
        productId: v7(),
        sku: 'SKU-002',
        name: 'Papas Saladas 45g',
        qty: 1000,
        unitPrice: 2000,
        taxRateId: v7(),
        taxRateBp: 1600,
        lineBase: 2000,
        lineDiscount: 200, // $2.00 discount
        orderDiscountShare: 0,
        taxableBase: 1800,
        tax: 288,
        lineTotal: 1800,
        note: 'Empaque especial',
        custom: {},
      },
    ],
    totals: {
      subtotal: 5600,
      lineDiscounts: 200,
      orderDiscount: 0,
      tax: 864,
      roundingAdjustment: 0,
      total: 5400, // $54.00
      taxBreakdown: [
        {
          taxRateId: v7(),
          rateBp: 1600,
          base: 5400,
          tax: 864,
        },
      ],
    },
    payments: [
      {
        id: v7(),
        method: 'cash',
        amount: 5400,
        tendered: 10000, // Paid with $100.00
        createdAt: '2026-11-01T12:00:00.000Z',
      },
    ],
    change: 4600, // $46.00 change
    pricesIncludeTax: true,
    currency: 'USD',
    notes: 'Venta mostrador',
    custom: {},
    fiscal: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    completedAt: '2026-11-01T12:00:00.000Z',
    schemaVersion: 1,
  };

  it('builds ReceiptDoc with header, lines, taxes, totals, payments and footer', () => {
    const doc = buildReceiptDoc({
      sale: sampleSale,
      business: sampleBusiness,
      currency: DEFAULT_CURRENCY,
      cashierName: 'Ana López',
      customerName: 'Carlos Slim',
      paperWidthMm: 80,
      openDrawer: true,
    });

    expect(doc.paperWidthMm).toBe(80);
    expect(doc.blocks[0]).toEqual({ type: 'pulse' });

    // Business name
    const nameBlock = doc.blocks.find((b) => b.type === 'text' && b.text === 'Abarrotes Don Pepe');
    expect(nameBlock).toBeDefined();

    // Folio
    const folioBlock = doc.blocks.find((b) => b.type === 'row' && b.left === 'Folio: L01-000123');
    expect(folioBlock).toBeDefined();

    // Total row
    const totalBlock = doc.blocks.find((b) => b.type === 'row' && b.left === 'TOTAL:');
    expect(totalBlock).toBeDefined();

    // Change row
    const changeBlock = doc.blocks.find((b) => b.type === 'row' && b.left === 'Cambio / Vuelto:');
    expect(changeBlock).toBeDefined();

    // Barcode block
    const barcodeBlock = doc.blocks.find((b) => b.type === 'barcode' && b.data === 'L01-000123');
    expect(barcodeBlock).toBeDefined();

    // Cut block
    const cutBlock = doc.blocks.find((b) => b.type === 'cut');
    expect(cutBlock).toBeDefined();
  });

  it('renders ReceiptDoc to HTML formatted for 58 mm and 80 mm printers', () => {
    const doc58 = buildReceiptDoc({
      sale: sampleSale,
      business: sampleBusiness,
      currency: DEFAULT_CURRENCY,
      paperWidthMm: 58,
    });

    const html58 = renderReceiptToHtml(doc58);
    expect(html58).toContain('<!DOCTYPE html>');
    expect(html58).toContain('58mm');
    expect(html58).toContain('Abarrotes Don Pepe');
    expect(html58).toContain('Refresco Cola 600ml');
    expect(html58).toContain('L01-000123');

    const doc80 = buildReceiptDoc({
      sale: sampleSale,
      business: sampleBusiness,
      currency: DEFAULT_CURRENCY,
      paperWidthMm: 80,
    });

    const html80 = renderReceiptToHtml(doc80);
    expect(html80).toContain('80mm');
  });

  it('escapes HTML special characters in business and product strings', () => {
    const xssSale: Sale = {
      ...sampleSale,
      lines: [
        {
          ...sampleSale.lines[0]!,
          name: '<script>alert("hack")</script> & "Cookies"',
        },
      ],
    };

    const doc = buildReceiptDoc({
      sale: xssSale,
      business: {
        name: 'La Tiendita <Rock & Roll>',
      },
      currency: DEFAULT_CURRENCY,
    });

    const html = renderReceiptToHtml(doc);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;Cookies&quot;');
  });

  describe('Property-Based Invariants (fast-check)', () => {
    const arbitraryCurrency: fc.Arbitrary<CurrencyConfig> = fc.record({
      code: fc.constantFrom('USD', 'MXN', 'EUR'),
      decimals: fc.constantFrom(0, 2),
      symbol: fc.constantFrom('$', '€'),
    });

    const arbitrarySale: fc.Arbitrary<Sale> = fc
      .tuple(
        fc.integer({ min: 100, max: 1000000 }), // total
        fc.integer({ min: 0, max: 50000 }), // change
        fc.stringMatching(/^[A-Z0-9]{3}-[0-9]{6}$/), // folio
      )
      .map(([total, change, number]) => ({
        ...sampleSale,
        number,
        totals: {
          subtotal: total + 1000,
          lineDiscounts: 1000,
          orderDiscount: 0,
          tax: 160,
          roundingAdjustment: 0,
          total,
          taxBreakdown: [],
        },
        change,
      }));

    it('always preserves total, subtotal and change exact strings without rounding drift', () => {
      fc.assert(
        fc.property(arbitrarySale, arbitraryCurrency, (sale, currency) => {
          const doc = buildReceiptDoc({
            sale,
            business: sampleBusiness,
            currency,
            paperWidthMm: 80,
          });

          // Check Total block
          const totalBlock = doc.blocks.find((b) => b.type === 'row' && b.left === 'TOTAL:');
          expect(totalBlock).toBeDefined();
          if (totalBlock && totalBlock.type === 'row') {
            expect(totalBlock.right).toBe(formatMoney(sale.totals.total, currency));
          }

          // Check Subtotal block
          const subtotalBlock = doc.blocks.find((b) => b.type === 'row' && b.left === 'Subtotal:');
          expect(subtotalBlock).toBeDefined();
          if (subtotalBlock && subtotalBlock.type === 'row') {
            expect(subtotalBlock.right).toBe(formatMoney(sale.totals.subtotal, currency));
          }

          // Check Change block if change > 0
          if (sale.change > 0) {
            const changeBlock = doc.blocks.find(
              (b) => b.type === 'row' && b.left === 'Cambio / Vuelto:',
            );
            expect(changeBlock).toBeDefined();
            if (changeBlock && changeBlock.type === 'row') {
              expect(changeBlock.right).toBe(formatMoney(sale.change, currency));
            }
          }

          // Render to HTML and verify validity
          const html = renderReceiptToHtml(doc);
          expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
          expect(html.endsWith('</html>')).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });
});
