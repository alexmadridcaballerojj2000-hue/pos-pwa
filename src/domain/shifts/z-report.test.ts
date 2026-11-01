import { describe, it, expect } from 'vitest';
import { buildZReportDoc } from './z-report';
import type { ShiftSummary } from './cash-calculation';
import type { CurrencyConfig } from '../format';

describe('Z-Report and X-Report generation (SPEC §6.5 & S7-T4)', () => {
  const currency: CurrencyConfig = {
    code: 'MXN',
    decimals: 2,
    symbol: '$',
  };

  const business = {
    name: 'Tienda La Esperanza',
    taxId: 'ESP123456789',
    address: 'Av. Siempre Viva 742',
    phone: '555-1234',
  };

  const mockSummary: ShiftSummary = {
    shift: {
      id: '018f0000-0000-7000-8000-000000000099',
      deviceId: '018f0000-0000-7000-8000-000000000001',
      openedBy: '018f0000-0000-7000-8000-000000000002',
      openedAt: '2026-11-01T08:00:00.000Z',
      openingFloat: 50000, // $500.00
      status: 'closed',
      closedBy: '018f0000-0000-7000-8000-000000000002',
      closedAt: '2026-11-01T16:00:00.000Z',
      countedCash: 75000,
      expectedCash: 72000,
      difference: 3000, // +$30.00 overage
    },
    sales: {
      totalSalesCount: 15,
      grossSales: 150000,
      lineDiscounts: 5000,
      orderDiscounts: 2000,
      totalDiscounts: 7000,
      tax: 18000,
      netTotal: 143000,
      cashSalesTotal: 20000,
      payments: {
        cash: { method: 'cash', count: 5, total: 20000 },
        card: { method: 'card', count: 10, total: 123000 },
      },
    },
    movements: {
      inCount: 1,
      inTotal: 5000,
      outCount: 1,
      outTotal: 3000,
      netMovement: 2000,
    },
    cashReturns: 0,
    expectedCash: 72000, // 50000 (float) + 20000 (cash) + 5000 (in) - 3000 (out)
    difference: 3000,
  };

  it('builds a complete Z-Report document for closing shift with overage', () => {
    const doc = buildZReportDoc({
      summary: mockSummary,
      business,
      currency,
      openedByName: 'Carlos Cajero',
      closedByName: 'Carlos Cajero',
      paperWidthMm: 80,
    });

    expect(doc.paperWidthMm).toBe(80);
    const texts = doc.blocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text);
    const rows = doc.blocks.filter(
      (b): b is { type: 'row'; left: string; right: string } => b.type === 'row',
    );

    // Title
    expect(texts).toContain('CORTE DE CAJA (REPORTE Z)');
    expect(texts).toContain('Tienda La Esperanza');

    // Metadata
    const openedByRow = rows.find((r) => r.left === 'Abierto por:');
    expect(openedByRow?.right).toBe('Carlos Cajero');

    // Cash reconciliation rows
    const floatRow = rows.find((r) => r.left === 'Fondo Inicial:');
    expect(floatRow?.right).toContain('500');

    const expectedRow = rows.find((r) => r.left === 'Total Efectivo Esperado:');
    expect(expectedRow?.right).toContain('720');

    const countedRow = rows.find((r) => r.left === 'Total Efectivo Contado:');
    expect(countedRow?.right).toContain('750');

    const diffRow = rows.find((r) => r.left === 'Diferencia:');
    expect(diffRow?.right).toContain('Sobrante');

    // Payments
    const cardRow = rows.find((r) => r.left.includes('Tarjeta'));
    expect(cardRow).toBeDefined();

    // End cut
    const cutBlock = doc.blocks.find((b) => b.type === 'cut');
    expect(cutBlock).toBeDefined();
  });

  it('correctly labels cash shortage when difference < 0', () => {
    const shortageSummary: ShiftSummary = {
      ...mockSummary,
      shift: {
        ...mockSummary.shift,
        countedCash: 70000,
        difference: -2000,
      },
      difference: -2000,
    };

    const doc = buildZReportDoc({
      summary: shortageSummary,
      business,
      currency,
    });

    const rows = doc.blocks.filter(
      (b): b is { type: 'row'; left: string; right: string } => b.type === 'row',
    );
    const diffRow = rows.find((r) => r.left === 'Diferencia:');
    expect(diffRow?.right).toContain('Faltante');
  });

  it('correctly labels balanced drawer when difference === 0', () => {
    const balancedSummary: ShiftSummary = {
      ...mockSummary,
      shift: {
        ...mockSummary.shift,
        countedCash: 72000,
        difference: 0,
      },
      difference: 0,
    };

    const doc = buildZReportDoc({
      summary: balancedSummary,
      business,
      currency,
    });

    const rows = doc.blocks.filter(
      (b): b is { type: 'row'; left: string; right: string } => b.type === 'row',
    );
    const diffRow = rows.find((r) => r.left === 'Diferencia:');
    expect(diffRow?.right).toContain('Cuadrado');
  });

  it('builds an X-Report (partial) without closing metadata or closing cut', () => {
    const partialDoc = buildZReportDoc({
      summary: mockSummary,
      business,
      currency,
      isPartialXReport: true,
      paperWidthMm: 58,
    });

    expect(partialDoc.paperWidthMm).toBe(58);
    const texts = partialDoc.blocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text);
    const rows = partialDoc.blocks.filter(
      (b): b is { type: 'row'; left: string; right: string } => b.type === 'row',
    );

    expect(texts).toContain('CORTE PARCIAL (REPORTE X)');
    // No "Cerrado por:" in partial report
    expect(rows.find((r) => r.left === 'Cerrado por:')).toBeUndefined();
  });
});
