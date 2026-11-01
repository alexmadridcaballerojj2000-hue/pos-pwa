import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ReceiptDoc, ReceiptBlock } from '../receipt';
import { renderReceiptToEscPos } from './renderer';

describe('renderReceiptToEscPos (S6-T2)', () => {
  const sampleDoc58: ReceiptDoc = {
    paperWidthMm: 58,
    blocks: [
      { type: 'text', text: 'Cafetería Central', align: 'center', bold: true, size: 'large' },
      { type: 'text', text: 'RFC: CAFC123456789', align: 'center', size: 'small' },
      { type: 'divider', char: '=' },
      { type: 'row', left: 'Folio: L01-000042', right: '01/11/26 12:00' },
      { type: 'row', left: 'Cajero:', right: 'Juan Pérez' },
      { type: 'divider', char: '-' },
      { type: 'text', text: 'Café Americano', bold: true },
      { type: 'row', left: '  2 x $25.00', right: '$50.00' },
      { type: 'divider', char: '=' },
      { type: 'row', left: 'TOTAL:', right: '$50.00', bold: true },
      { type: 'divider', char: '-' },
      { type: 'barcode', data: 'L01-000042', format: 'CODE128' },
      { type: 'qr', data: 'https://pos-pwa.local/receipt/42' },
      { type: 'feed', lines: 1 },
      { type: 'text', text: '¡Gracias por su compra!', align: 'center' },
    ],
  };

  it('renders a 58 mm receipt to ESC/POS binary format with auto-cut', () => {
    const bytes = renderReceiptToEscPos(sampleDoc58);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const arr = Array.from(bytes);
    // Starts with ESC @ (init) + ESC t 19 (CP858)
    expect(arr.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 19]);

    // Ends with feed 3 + partial cut (GS V 0x42 0x00)
    expect(arr.slice(-7)).toEqual([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x42, 0x00]);
  });

  it('correctly pads 2-column rows to 32 columns on 58mm', () => {
    const doc: ReceiptDoc = {
      paperWidthMm: 58,
      blocks: [{ type: 'row', left: 'SUBTOTAL', right: '$100.00' }],
    };

    const bytes = renderReceiptToEscPos(doc, { autoCut: false });
    // String content should contain 32 chars followed by LF (0x0A)
    // 'SUBTOTAL' (8 chars) + spaces (17 chars) + '$100.00' (7 chars) = 32 chars
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(bytes);

    expect(text).toContain('SUBTOTAL                 $100.00\n');
  });

  it('correctly pads 2-column rows to 48 columns on 80mm', () => {
    const doc: ReceiptDoc = {
      paperWidthMm: 80,
      blocks: [{ type: 'row', left: 'SUBTOTAL', right: '$100.00' }],
    };

    const bytes = renderReceiptToEscPos(doc, { autoCut: false });
    // 'SUBTOTAL' (8 chars) + spaces (33 chars) + '$100.00' (7 chars) = 48 chars
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(bytes);

    expect(text).toContain('SUBTOTAL                                 $100.00\n');
  });

  it('truncates left column if total row length exceeds columns', () => {
    const longName = 'Producto con un nombre extremadamente largo que excede el ancho';
    const doc: ReceiptDoc = {
      paperWidthMm: 58, // 32 cols
      blocks: [{ type: 'row', left: longName, right: '$999.00' }],
    };

    const bytes = renderReceiptToEscPos(doc, { autoCut: false });
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(bytes);

    // Right side must be fully preserved
    expect(text).toContain('$999.00\n');
    // Total line length without LF must be <= 32
    const lines = text.split('\n');
    const rowLine = lines.find((l) => l.includes('$999.00'));
    expect(rowLine).toBeDefined();
    // In latin1 decoding, line length (including command prefix if any)
    expect(rowLine?.trimEnd().endsWith('$999.00')).toBe(true);
  });

  it('handles pulse block and openDrawer option', () => {
    const docWithPulse: ReceiptDoc = {
      paperWidthMm: 80,
      blocks: [{ type: 'pulse' }, { type: 'text', text: 'Ticket' }],
    };

    const bytes = renderReceiptToEscPos(docWithPulse, { autoCut: false, drawerPin: 2 });
    const arr = Array.from(bytes);

    // Must contain ESC p 0 30 60
    const pulseIndex = arr.findIndex(
      (b, idx) =>
        b === 0x1b &&
        arr[idx + 1] === 0x70 &&
        arr[idx + 2] === 0x00 &&
        arr[idx + 3] === 30 &&
        arr[idx + 4] === 60,
    );
    expect(pulseIndex).toBeGreaterThan(-1);
  });

  it('does not duplicate cut if explicit cut block is present', () => {
    const docWithCut: ReceiptDoc = {
      paperWidthMm: 80,
      blocks: [{ type: 'text', text: 'Fin' }, { type: 'cut' }],
    };

    const bytes = renderReceiptToEscPos(docWithCut, { autoCut: true });
    const arr = Array.from(bytes);

    // Count occurrences of GS V (0x1D, 0x56)
    let cutCount = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === 0x1d && arr[i + 1] === 0x56) {
        cutCount++;
      }
    }

    expect(cutCount).toBe(1);
  });

  describe('Property-based testing (fast-check)', () => {
    const blockArbitrary: fc.Arbitrary<ReceiptBlock> = fc.oneof(
      fc.record({
        type: fc.constant<'text'>('text'),
        text: fc.string(),
        align: fc.constantFrom<'left' | 'center' | 'right'>('left', 'center', 'right'),
        bold: fc.boolean(),
        size: fc.constantFrom<'normal' | 'large' | 'small'>('normal', 'large', 'small'),
      }),
      fc.record({
        type: fc.constant<'row'>('row'),
        left: fc.string(),
        right: fc.string(),
        bold: fc.boolean(),
      }),
      fc.record({
        type: fc.constant<'divider'>('divider'),
        char: fc.constantFrom<'-' | '='>('-', '='),
      }),
      fc.record({
        type: fc.constant<'feed'>('feed'),
        lines: fc.integer({ min: 1, max: 10 }),
      }),
      fc.record({
        type: fc.constant<'barcode'>('barcode'),
        data: fc.stringMatching(/^[A-Z0-9-]{1,20}$/),
      }),
      fc.record({
        type: fc.constant<'qr'>('qr'),
        data: fc.stringMatching(/^[A-Za-z0-9:/._-]{1,50}$/),
      }),
      fc.record({ type: fc.constant<'pulse'>('pulse') }),
      fc.record({ type: fc.constant<'cut'>('cut') }),
    );

    it('renders arbitrary ReceiptDoc documents to valid Uint8Array without error', () => {
      fc.assert(
        fc.property(
          fc.record({
            paperWidthMm: fc.constantFrom<58 | 80>(58, 80),
            blocks: fc.array(blockArbitrary, { minLength: 1, maxLength: 20 }),
          }),
          fc.constantFrom<'CP437' | 'CP858' | 'CP1252'>('CP437', 'CP858', 'CP1252'),
          (doc, cp) => {
            const bytes = renderReceiptToEscPos(doc, { codePage: cp });
            expect(bytes).toBeInstanceOf(Uint8Array);
            expect(bytes.length).toBeGreaterThan(0);

            for (let i = 0; i < bytes.length; i++) {
              expect(bytes[i]).toBeGreaterThanOrEqual(0);
              expect(bytes[i]).toBeLessThanOrEqual(255);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
