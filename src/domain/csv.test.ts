import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseCsv, parseCsvWithHeader, serializeCsv, validateProductCsvRows } from './csv';

describe('CSV Parser RFC 4180 (S3-T4)', () => {
  it('parses basic comma-separated rows with CRLF and LF', () => {
    const csvLF = 'sku,name,price\nPROD-1,Coca Cola,15.50\nPROD-2,Pepsi,14.00';
    const parsedLF = parseCsv(csvLF);
    expect(parsedLF).toEqual([
      ['sku', 'name', 'price'],
      ['PROD-1', 'Coca Cola', '15.50'],
      ['PROD-2', 'Pepsi', '14.00'],
    ]);

    const csvCRLF = 'sku,name,price\r\nPROD-1,Coca Cola,15.50\r\nPROD-2,Pepsi,14.00\r\n';
    const parsedCRLF = parseCsv(csvCRLF);
    expect(parsedCRLF).toEqual([
      ['sku', 'name', 'price'],
      ['PROD-1', 'Coca Cola', '15.50'],
      ['PROD-2', 'Pepsi', '14.00'],
    ]);
  });

  it('handles fields containing commas, quotes, and newlines inside quotes', () => {
    const complexCsv =
      'sku,name,description\n' +
      'A1,"Shirt, Blue","Line 1\nLine 2"\n' +
      'B2,"He said ""Hello!""",Standard';

    const parsed = parseCsv(complexCsv);
    expect(parsed).toEqual([
      ['sku', 'name', 'description'],
      ['A1', 'Shirt, Blue', 'Line 1\nLine 2'],
      ['B2', 'He said "Hello!"', 'Standard'],
    ]);
  });

  it('parseCsvWithHeader handles header mapping and normalizes keys', () => {
    const text = 'SKU,Nombre,PRECIO,Categoría\nS1,Galletas,10.50,Snacks\nS2,Agua,5.00,Bebidas';
    const { headers, rows } = parseCsvWithHeader(text);
    expect(headers).toEqual(['sku', 'nombre', 'precio', 'categoría']);
    expect(rows).toEqual([
      { sku: 'S1', nombre: 'Galletas', precio: '10.50', categoría: 'Snacks' },
      { sku: 'S2', nombre: 'Agua', precio: '5.00', categoría: 'Bebidas' },
    ]);
  });

  it('validateProductCsvRows flags missing required fields and duplicate SKUs', () => {
    const rows: Record<string, string | undefined>[] = [
      { sku: 'P1', name: 'Product 1', price: '100', barcodes: '111|222', track_stock: 'true' },
      { sku: 'P2', name: '', price: '50' }, // Missing name
      { sku: '', name: 'Product 3', price: '20' }, // Missing SKU
      { sku: 'P1', name: 'Product 4 Duplicate', price: '-5' }, // Duplicate SKU + negative price
    ];

    const validations = validateProductCsvRows(rows);
    expect(validations[0]?.isValid).toBe(true);
    expect(validations[0]?.product?.barcodes).toEqual(['111', '222']);
    expect(validations[0]?.product?.priceMinor).toBe(10000);

    expect(validations[1]?.isValid).toBe(false);
    expect(validations[1]?.errors).toContain('El nombre es obligatorio');

    expect(validations[2]?.isValid).toBe(false);
    expect(validations[2]?.errors).toContain('El SKU es obligatorio');

    expect(validations[3]?.isValid).toBe(false);
    expect(validations[3]?.errors).toContain('SKU duplicado en el archivo: "P1"');
    expect(validations[3]?.errors).toContain('El precio debe ser un número mayor o igual a 0');
  });

  it('fast-check property: parse(serialize(matrix)) roundtrip preserves cell contents', () => {
    // Multi-column rows with arbitrary text including quotes, commas, and newlines
    const cellArbitrary = fc.string({ maxLength: 50 });
    const rowArbitrary = fc.array(cellArbitrary, { minLength: 2, maxLength: 8 });
    const tableArbitrary = fc.array(rowArbitrary, { minLength: 1, maxLength: 15 });

    fc.assert(
      fc.property(tableArbitrary, (table) => {
        const serialized = serializeCsv(table);
        const parsed = parseCsv(serialized);
        expect(parsed).toEqual(table);
      }),
      { numRuns: 300 },
    );
  });
});
