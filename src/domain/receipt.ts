import type { CurrencyConfig, ISODate, Sale } from './index';
import { formatMoney, formatQuantity } from './format';

export type ReceiptAlign = 'left' | 'center' | 'right';

export interface ReceiptTextLine {
  type: 'text';
  text: string;
  align?: ReceiptAlign;
  bold?: boolean;
  size?: 'normal' | 'large' | 'small';
}

export interface ReceiptRow {
  type: 'row';
  left: string;
  right: string;
  bold?: boolean;
}

export interface ReceiptDivider {
  type: 'divider';
  char?: '-' | '=' | '*';
}

export interface ReceiptFeed {
  type: 'feed';
  lines: number;
}

export interface ReceiptBarcode {
  type: 'barcode';
  data: string;
  format?: 'CODE128' | 'EAN13';
}

export interface ReceiptQr {
  type: 'qr';
  data: string;
}

export interface ReceiptCut {
  type: 'cut';
  partial?: boolean;
}

export interface ReceiptPulse {
  type: 'pulse';
}

export type ReceiptBlock =
  | ReceiptTextLine
  | ReceiptRow
  | ReceiptDivider
  | ReceiptFeed
  | ReceiptBarcode
  | ReceiptQr
  | ReceiptCut
  | ReceiptPulse;

export interface ReceiptDoc {
  paperWidthMm: 58 | 80;
  blocks: ReceiptBlock[];
}

export interface BuildReceiptDocParams {
  sale: Sale;
  business: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    footerText?: string;
  };
  currency: CurrencyConfig;
  cashierName?: string;
  customerName?: string;
  paymentMethodLabels?: Record<string, string>;
  paperWidthMm?: 58 | 80;
  openDrawer?: boolean;
}

/**
 * Builds an intermediate representation (ReceiptDoc) from a Sale document (SPEC §9).
 * Pure domain function with no UI or hardware dependencies.
 */
export function buildReceiptDoc(params: BuildReceiptDocParams): ReceiptDoc {
  const {
    sale,
    business,
    currency,
    cashierName,
    customerName,
    paymentMethodLabels = {},
    paperWidthMm = 80,
    openDrawer = false,
  } = params;

  const blocks: ReceiptBlock[] = [];

  // 1. Drawer pulse if requested
  if (openDrawer) {
    blocks.push({ type: 'pulse' });
  }

  // 2. Business Header
  blocks.push({
    type: 'text',
    text: business.name || 'Punto de Venta',
    align: 'center',
    bold: true,
    size: 'large',
  });

  if (business.taxId) {
    blocks.push({
      type: 'text',
      text: `RFC/ID: ${business.taxId}`,
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

  // 3. Sale Metadata
  blocks.push({
    type: 'row',
    left: `Folio: ${sale.number}`,
    right: formatIsoDate(sale.completedAt),
  });

  if (cashierName) {
    blocks.push({
      type: 'row',
      left: 'Cajero:',
      right: cashierName,
    });
  }

  blocks.push({
    type: 'row',
    left: 'Cliente:',
    right: customerName ?? 'Público General',
  });

  blocks.push({ type: 'divider', char: '-' });

  // 4. Products / Lines Table
  for (const line of sale.lines) {
    // Product Name
    blocks.push({
      type: 'text',
      text: line.name,
      bold: true,
    });

    // Quantity, Unit Price and Total
    const qtyStr = formatQuantity(line.qty, undefined, 'es-ES');
    const unitPriceStr = formatMoney(line.unitPrice, currency);
    const lineTotalStr = formatMoney(line.lineTotal, currency);

    blocks.push({
      type: 'row',
      left: `  ${qtyStr} x ${unitPriceStr}`,
      right: lineTotalStr,
    });

    // Line discount if any
    if (line.lineDiscount > 0) {
      blocks.push({
        type: 'row',
        left: '    (Descuento)',
        right: `-${formatMoney(line.lineDiscount, currency)}`,
      });
    }

    // Line note if any
    if (line.note) {
      blocks.push({
        type: 'text',
        text: `    Nota: ${line.note}`,
        size: 'small',
      });
    }
  }

  blocks.push({ type: 'divider', char: '-' });

  // 5. Totals
  blocks.push({
    type: 'row',
    left: 'Subtotal:',
    right: formatMoney(sale.totals.subtotal, currency),
  });

  if (sale.totals.lineDiscounts > 0) {
    blocks.push({
      type: 'row',
      left: 'Descuentos de Línea:',
      right: `-${formatMoney(sale.totals.lineDiscounts, currency)}`,
    });
  }

  if (sale.totals.orderDiscount > 0) {
    blocks.push({
      type: 'row',
      left: 'Descuento General:',
      right: `-${formatMoney(sale.totals.orderDiscount, currency)}`,
    });
  }

  // Tax breakdown
  if (sale.totals.taxBreakdown && sale.totals.taxBreakdown.length > 0) {
    for (const tb of sale.totals.taxBreakdown) {
      if (tb.tax > 0) {
        const ratePercent = tb.rateBp / 100;
        blocks.push({
          type: 'row',
          left: `Impuesto (${ratePercent}%):`,
          right: formatMoney(tb.tax, currency),
        });
      }
    }
  } else if (sale.totals.tax > 0) {
    blocks.push({
      type: 'row',
      left: 'Impuestos:',
      right: formatMoney(sale.totals.tax, currency),
    });
  }

  blocks.push({ type: 'divider', char: '=' });

  // Final Total
  blocks.push({
    type: 'row',
    left: 'TOTAL:',
    right: formatMoney(sale.totals.total, currency),
    bold: true,
  });

  blocks.push({ type: 'divider', char: '-' });

  // 6. Payments Breakdown
  for (const payment of sale.payments) {
    const label = paymentMethodLabels[payment.method] ?? payment.method;
    blocks.push({
      type: 'row',
      left: `Pago ${label}:`,
      right: formatMoney(payment.amount, currency),
    });

    if (payment.tendered && payment.tendered > payment.amount) {
      blocks.push({
        type: 'row',
        left: '  Entregado:',
        right: formatMoney(payment.tendered, currency),
      });
    }

    if (payment.reference) {
      blocks.push({
        type: 'text',
        text: `  Ref: ${payment.reference}`,
        size: 'small',
      });
    }
  }

  // Change / Vuelto
  if (sale.change > 0) {
    blocks.push({
      type: 'row',
      left: 'Cambio / Vuelto:',
      right: formatMoney(sale.change, currency),
      bold: true,
    });
  }

  blocks.push({ type: 'divider', char: '-' });

  // 7. Footer
  const footerText = business.footerText?.trim() || '¡Gracias por su compra!';
  blocks.push({
    type: 'text',
    text: footerText,
    align: 'center',
  });

  blocks.push({ type: 'feed', lines: 1 });

  // 8. Barcode with sale folio
  blocks.push({
    type: 'barcode',
    data: sale.number,
    format: 'CODE128',
  });

  blocks.push({ type: 'feed', lines: 2 });

  // 9. Cut paper
  blocks.push({ type: 'cut' });

  return {
    paperWidthMm,
    blocks,
  };
}

/**
 * Helper to escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format ISO date string into concise date/time for receipts.
 */
function formatIsoDate(iso: ISODate): string {
  try {
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return iso;
  }
}

/**
 * Renders a ReceiptDoc to thermal-optimized HTML string with @page and @media print CSS (SPEC §9).
 * Compatible with 58 mm and 80 mm thermal printers.
 */
export function renderReceiptToHtml(doc: ReceiptDoc): string {
  const widthMm = doc.paperWidthMm;
  const fontSize = widthMm === 58 ? '11px' : '12px';

  const bodyContent = doc.blocks
    .map((block) => {
      switch (block.type) {
        case 'pulse':
          return ''; // hardware pulse only
        case 'text': {
          const align = block.align ?? 'left';
          const weight = block.bold ? 'bold' : 'normal';
          const sizeMultiplier =
            block.size === 'large' ? '1.25em' : block.size === 'small' ? '0.85em' : '1em';
          return `<div style="text-align: ${align}; font-weight: ${weight}; font-size: ${sizeMultiplier}; margin: 1px 0;">${escapeHtml(
            block.text,
          )}</div>`;
        }
        case 'row': {
          const weight = block.bold ? 'bold' : 'normal';
          return `<div style="display: flex; justify-content: space-between; font-weight: ${weight}; margin: 1px 0;"><span>${escapeHtml(
            block.left,
          )}</span><span>${escapeHtml(block.right)}</span></div>`;
        }
        case 'divider': {
          const borderStyle = block.char === '=' ? 'double' : 'dashed';
          return `<div style="border-top: 1px ${borderStyle} #000; margin: 4px 0;"></div>`;
        }
        case 'feed': {
          return `<div style="height: ${block.lines * 1.2}em;"></div>`;
        }
        case 'barcode': {
          return `<div style="text-align: center; margin: 6px 0; font-family: monospace; letter-spacing: 2px; font-weight: bold;">*${escapeHtml(
            block.data,
          )}*</div>`;
        }
        case 'qr': {
          return `<div style="text-align: center; margin: 6px 0; font-size: 0.85em;">[QR: ${escapeHtml(
            block.data,
          )}]</div>`;
        }
        case 'cut': {
          return '<div class="receipt-cut" style="display: none;"></div>';
        }
        default:
          return '';
      }
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Comprobante de Venta</title>
  <style>
    @page {
      size: ${widthMm}mm auto;
      margin: 0;
    }
    @media print {
      body {
        width: ${widthMm}mm;
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }
    .receipt-container {
      width: ${widthMm}mm;
      max-width: ${widthMm}mm;
      margin: 0 auto;
      padding: 3mm 4mm;
      box-sizing: border-box;
      font-family: monospace, 'Courier New', Courier, sans-serif;
      font-size: ${fontSize};
      line-height: 1.3;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
${bodyContent}
  </div>
</body>
</html>`;
}
