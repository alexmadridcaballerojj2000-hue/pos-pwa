import type { CurrencyConfig } from '../format';
import { formatMoney } from '../format';
import type { ReceiptBlock, ReceiptDoc } from '../receipt';
import type { ShiftSummary } from './cash-calculation';

export interface BuildZReportParams {
  summary: ShiftSummary;
  business: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
  };
  currency: CurrencyConfig;
  openedByName?: string;
  closedByName?: string;
  paperWidthMm?: 58 | 80;
  isPartialXReport?: boolean;
  cutPaper?: boolean;
  paymentMethodLabels?: Record<string, string>;
}

function formatDateString(isoString?: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return isoString;
  }
}

/**
 * Builds a printable ReceiptDoc for a shift Z-Report (closing) or partial X-Report (audit).
 * Pure domain function with zero DOM/hardware dependencies according to SPEC §6.5 & §9.
 */
export function buildZReportDoc(params: BuildZReportParams): ReceiptDoc {
  const {
    summary,
    business,
    currency,
    openedByName,
    closedByName,
    paperWidthMm = 80,
    isPartialXReport = false,
    cutPaper = true,
    paymentMethodLabels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      other: 'Otro',
    },
  } = params;

  const { shift, sales, movements, cashReturns, expectedCash, difference } = summary;
  const blocks: ReceiptBlock[] = [];

  // 1. Header
  blocks.push({
    type: 'text',
    text: business.name,
    align: 'center',
    bold: true,
    size: 'large',
  });

  if (business.taxId) {
    blocks.push({
      type: 'text',
      text: `RFC / NIF: ${business.taxId}`,
      align: 'center',
      size: 'small',
    });
  }
  if (business.address) {
    blocks.push({
      type: 'text',
      text: business.address,
      align: 'center',
      size: 'small',
    });
  }
  if (business.phone) {
    blocks.push({
      type: 'text',
      text: `Tel: ${business.phone}`,
      align: 'center',
      size: 'small',
    });
  }

  blocks.push({ type: 'divider', char: '=' });

  // 2. Report Title
  const title = isPartialXReport ? 'CORTE PARCIAL (REPORTE X)' : 'CORTE DE CAJA (REPORTE Z)';
  blocks.push({
    type: 'text',
    text: title,
    align: 'center',
    bold: true,
    size: 'normal',
  });

  blocks.push({ type: 'divider', char: '-' });

  // 3. Shift Metadata
  blocks.push({
    type: 'row',
    left: 'Turno ID:',
    right: shift.id.slice(0, 8),
  });
  blocks.push({
    type: 'row',
    left: 'Apertura:',
    right: formatDateString(shift.openedAt),
  });
  if (openedByName) {
    blocks.push({
      type: 'row',
      left: 'Abierto por:',
      right: openedByName,
    });
  }

  if (!isPartialXReport && shift.closedAt) {
    blocks.push({
      type: 'row',
      left: 'Cierre:',
      right: formatDateString(shift.closedAt),
    });
    if (closedByName) {
      blocks.push({
        type: 'row',
        left: 'Cerrado por:',
        right: closedByName,
      });
    }
  }

  blocks.push({ type: 'divider', char: '=' });

  // 4. Cash Reconciliation (SPEC §6.5)
  blocks.push({
    type: 'text',
    text: 'ARQUEO DE EFECTIVO',
    bold: true,
    align: 'left',
  });

  blocks.push({
    type: 'row',
    left: 'Fondo Inicial:',
    right: formatMoney(shift.openingFloat, currency),
  });
  blocks.push({
    type: 'row',
    left: '(+) Ventas en Efectivo:',
    right: formatMoney(sales.cashSalesTotal, currency),
  });
  blocks.push({
    type: 'row',
    left: '(+) Entradas Efectivo:',
    right: formatMoney(movements.inTotal, currency),
  });
  blocks.push({
    type: 'row',
    left: '(-) Salidas Efectivo:',
    right: formatMoney(movements.outTotal, currency),
  });

  if (cashReturns > 0) {
    blocks.push({
      type: 'row',
      left: '(-) Devoluciones Efectivo:',
      right: formatMoney(cashReturns, currency),
    });
  }

  blocks.push({ type: 'divider', char: '-' });

  blocks.push({
    type: 'row',
    left: 'Total Efectivo Esperado:',
    right: formatMoney(expectedCash, currency),
    bold: true,
  });

  if (shift.countedCash !== undefined) {
    blocks.push({
      type: 'row',
      left: 'Total Efectivo Contado:',
      right: formatMoney(shift.countedCash, currency),
      bold: true,
    });

    const diff = difference ?? 0;
    let diffLabel = '0.00 (Cuadrado)';
    if (diff > 0) {
      diffLabel = `+${formatMoney(diff, currency)} (Sobrante)`;
    } else if (diff < 0) {
      diffLabel = `-${formatMoney(Math.abs(diff), currency)} (Faltante)`;
    }

    blocks.push({
      type: 'row',
      left: 'Diferencia:',
      right: diffLabel,
      bold: true,
    });
  }

  blocks.push({ type: 'divider', char: '=' });

  // 5. Sales by Payment Method
  blocks.push({
    type: 'text',
    text: 'VENTAS POR FORMA DE PAGO',
    bold: true,
    align: 'left',
  });

  const paymentEntries = Object.entries(sales.payments);
  if (paymentEntries.length === 0) {
    blocks.push({
      type: 'text',
      text: 'Sin ventas registradas en el turno',
      align: 'left',
      size: 'small',
    });
  } else {
    for (const [method, p] of paymentEntries) {
      const label = paymentMethodLabels[method] || method;
      blocks.push({
        type: 'row',
        left: `${label} (${p.count}):`,
        right: formatMoney(p.total, currency),
      });
    }
  }

  blocks.push({ type: 'divider', char: '-' });

  blocks.push({
    type: 'row',
    left: 'Total Ventas Netas:',
    right: formatMoney(sales.netTotal, currency),
    bold: true,
  });

  blocks.push({ type: 'divider', char: '-' });

  // 6. Global Totals and Metrics
  blocks.push({
    type: 'row',
    left: 'Tickets Emitidos:',
    right: `${sales.totalSalesCount}`,
  });
  blocks.push({
    type: 'row',
    left: 'Ventas Brutas:',
    right: formatMoney(sales.grossSales, currency),
  });

  if (sales.totalDiscounts > 0) {
    blocks.push({
      type: 'row',
      left: 'Descuentos Totales:',
      right: `-${formatMoney(sales.totalDiscounts, currency)}`,
    });
  }

  blocks.push({
    type: 'row',
    left: 'Impuestos Recaudados:',
    right: formatMoney(sales.tax, currency),
  });

  const avgTicket =
    sales.totalSalesCount > 0 ? Math.round(sales.netTotal / sales.totalSalesCount) : 0;
  blocks.push({
    type: 'row',
    left: 'Ticket Promedio:',
    right: formatMoney(avgTicket, currency),
  });

  // 7. Cash movements breakdown
  if (movements.inCount > 0 || movements.outCount > 0) {
    blocks.push({ type: 'divider', char: '-' });
    blocks.push({
      type: 'text',
      text: 'MOVIMIENTOS DE CAJA',
      bold: true,
      align: 'left',
    });
    blocks.push({
      type: 'row',
      left: `Entradas (${movements.inCount}):`,
      right: `+${formatMoney(movements.inTotal, currency)}`,
    });
    blocks.push({
      type: 'row',
      left: `Salidas (${movements.outCount}):`,
      right: `-${formatMoney(movements.outTotal, currency)}`,
    });
  }

  // 8. Footer
  blocks.push({ type: 'divider', char: '=' });
  blocks.push({
    type: 'text',
    text: isPartialXReport ? '--- FIN REPORTE X ---' : '--- FIN REPORTE Z ---',
    align: 'center',
    bold: true,
  });

  blocks.push({ type: 'feed', lines: 3 });

  if (cutPaper) {
    blocks.push({ type: 'cut', partial: false });
  }

  return {
    paperWidthMm,
    blocks,
  };
}
