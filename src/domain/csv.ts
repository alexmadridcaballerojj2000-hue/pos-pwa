import type { ProductUnit } from './types';

/**
 * Pure RFC 4180 CSV parser.
 * Supports:
 * - CRLF and LF newlines
 * - Fields quoted with ""
 * - Escaped double quotes ("") inside quoted fields
 * - Commas and newlines within quoted fields
 */
export function parseCsv(text: string): string[][] {
  const result: string[][] = [];
  if (!text || text.length === 0) return result;

  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      }

      if (char === '\r') {
        if (i + 1 < len && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        result.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      }

      if (char === '\n') {
        currentRow.push(currentField);
        result.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      }

      currentField += char;
      i++;
    }
  }

  // Push remainder if not empty or if row has accumulated cells
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    result.push(currentRow);
  }

  // Clean trailing empty single-element row that can occur from trailing newline
  if (
    result.length > 0 &&
    result[result.length - 1]?.length === 1 &&
    result[result.length - 1]?.[0] === ''
  ) {
    result.pop();
  }

  return result;
}

/**
 * Parses CSV text and maps header columns to row objects.
 */
export function parseCsvWithHeader(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const parsed = parseCsv(text);
  if (parsed.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = parsed[0] || [];
  const headers = rawHeaders.map((h) => h.trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < parsed.length; r++) {
    const row = parsed[r];
    if (!row) continue;
    // Skip empty lines
    if (row.length === 1 && !row[0]?.trim()) continue;

    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header) {
        rowObj[header] = (row[c] ?? '').trim();
      }
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Serializes a matrix of strings to RFC 4180 CSV text.
 */
export function serializeCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (
            cell.includes(',') ||
            cell.includes('"') ||
            cell.includes('\n') ||
            cell.includes('\r')
          ) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(','),
    )
    .join('\r\n');
}

export interface CsvProductParsed {
  sku: string;
  name: string;
  barcodes: string[];
  categoryName?: string;
  priceMinor: number;
  costMinor?: number;
  taxRatePercent?: number;
  trackStock: boolean;
  unit: ProductUnit;
  allowFractional: boolean;
  custom: Record<string, unknown>;
}

export interface CsvRowValidation {
  rowNumber: number;
  raw: Record<string, string | undefined>;
  product?: CsvProductParsed;
  errors: string[];
  isValid: boolean;
}

const VALID_UNITS: Set<string> = new Set(['unit', 'kg', 'g', 'l', 'ml', 'm']);

/**
 * Validates parsed CSV rows for product bulk import according to SPEC §3.1.
 */
export function validateProductCsvRows(
  rows: Record<string, string | undefined>[],
): CsvRowValidation[] {
  const seenSkus = new Set<string>();

  return rows.map((raw, idx) => {
    const rowNumber = idx + 2; // 1-indexed, skipping header
    const errors: string[] = [];

    // SKU
    const sku = (raw.sku || raw['codigo'] || raw['código'] || '').trim();
    if (!sku) {
      errors.push('El SKU es obligatorio');
    } else if (seenSkus.has(sku)) {
      errors.push(`SKU duplicado en el archivo: "${sku}"`);
    } else {
      seenSkus.add(sku);
    }

    // Name
    const name = (
      raw.name ||
      raw['nombre'] ||
      raw['descripcion'] ||
      raw['descripción'] ||
      ''
    ).trim();
    if (!name) {
      errors.push('El nombre es obligatorio');
    }

    // Price
    const priceStr = raw.price || raw['precio'] || '';
    const priceNum = parseFloat(priceStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(priceNum) || priceNum < 0) {
      errors.push('El precio debe ser un número mayor o igual a 0');
    }

    // Cost (optional)
    const costStr = raw.cost || raw['costo'] || '';
    let costMinor: number | undefined = undefined;
    if (costStr) {
      const costNum = parseFloat(costStr.replace(/[^0-9.-]/g, ''));
      if (isNaN(costNum) || costNum < 0) {
        errors.push('El costo debe ser un número válido mayor o igual a 0');
      } else {
        costMinor = Math.round(costNum * 100);
      }
    }

    // Barcodes (split by | or ;)
    const barcodeStr = raw.barcodes || raw['codigos'] || raw['códigos'] || raw['barcode'] || '';
    const barcodes = barcodeStr
      ? barcodeStr
          .split(/[|;]/)
          .map((b) => b.trim())
          .filter(Boolean)
      : [];

    // Category
    const categoryName =
      (raw.category || raw['categoria'] || raw['categoría'] || '').trim() || undefined;

    // Tax rate % (optional, e.g. 16 or 0.16)
    const taxStr = raw.tax_rate || raw['impuesto'] || raw['iva'] || '';
    let taxRatePercent: number | undefined = undefined;
    if (taxStr) {
      const taxNum = parseFloat(taxStr.replace(/[^0-9.-]/g, ''));
      if (!isNaN(taxNum)) {
        taxRatePercent = taxNum > 1 ? taxNum : taxNum * 100;
      }
    }

    // Track stock
    const trackStockStr = (
      raw.track_stock ||
      raw['inventario'] ||
      raw['controla_stock'] ||
      ''
    ).toLowerCase();
    const trackStock =
      trackStockStr === 'false' || trackStockStr === '0' || trackStockStr === 'no' ? false : true;

    // Unit
    const unitStr = (raw.unit || raw['unidad'] || 'unit').toLowerCase();
    const unit: ProductUnit = VALID_UNITS.has(unitStr) ? (unitStr as ProductUnit) : 'unit';

    // Allow fractional
    const fractionalStr = (
      raw.allow_fractional ||
      raw['fraccionario'] ||
      raw['permite_decimales'] ||
      ''
    ).toLowerCase();
    const allowFractional =
      fractionalStr === 'true' ||
      fractionalStr === '1' ||
      fractionalStr === 'si' ||
      fractionalStr === 'sí';

    const isValid = errors.length === 0;

    let product: CsvProductParsed | undefined = undefined;
    if (isValid) {
      product = {
        sku,
        name,
        barcodes,
        categoryName,
        priceMinor: Math.round(priceNum * 100),
        costMinor,
        taxRatePercent,
        trackStock,
        unit,
        allowFractional,
        custom: {},
      };
    }

    return {
      rowNumber,
      raw,
      product,
      errors,
      isValid,
    };
  });
}
