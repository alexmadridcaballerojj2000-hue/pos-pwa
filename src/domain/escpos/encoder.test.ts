import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { EscPosEncoder } from './encoder';
import { encodeString, CODE_PAGES } from './codepages';

describe('EscPosEncoder (S6-T1)', () => {
  it('encodes init command (ESC @)', () => {
    const bytes = new EscPosEncoder().init().build();
    expect(Array.from(bytes)).toEqual([0x1b, 0x40]);
  });

  it('encodes justification / alignment commands (ESC a n)', () => {
    expect(Array.from(new EscPosEncoder().setAlign('left').build())).toEqual([0x1b, 0x61, 0x00]);
    expect(Array.from(new EscPosEncoder().setAlign('center').build())).toEqual([0x1b, 0x61, 0x01]);
    expect(Array.from(new EscPosEncoder().setAlign('right').build())).toEqual([0x1b, 0x61, 0x02]);
  });

  it('encodes bold command (ESC E n)', () => {
    expect(Array.from(new EscPosEncoder().setBold(true).build())).toEqual([0x1b, 0x45, 0x01]);
    expect(Array.from(new EscPosEncoder().setBold(false).build())).toEqual([0x1b, 0x45, 0x00]);
  });

  it('encodes underline command (ESC - n)', () => {
    expect(Array.from(new EscPosEncoder().setUnderline(1).build())).toEqual([0x1b, 0x2d, 0x01]);
    expect(Array.from(new EscPosEncoder().setUnderline(0).build())).toEqual([0x1b, 0x2d, 0x00]);
  });

  it('encodes character sizing command (GS ! n) with clamping', () => {
    // 1x1: w=0, h=0 -> 0x00
    expect(Array.from(new EscPosEncoder().setSize(1, 1).build())).toEqual([0x1d, 0x21, 0x00]);
    // 2x2: w=1, h=1 -> (1 << 4) | 1 = 0x11 = 17
    expect(Array.from(new EscPosEncoder().setSize(2, 2).build())).toEqual([0x1d, 0x21, 0x11]);
    // Clamping: (10, 0) clamped to (8, 1) -> (7 << 4) | 0 = 0x70 = 112
    expect(Array.from(new EscPosEncoder().setSize(10, 0).build())).toEqual([0x1d, 0x21, 0x70]);
  });

  it('encodes paper feed command (ESC d n)', () => {
    expect(Array.from(new EscPosEncoder().feed(1).build())).toEqual([0x1b, 0x64, 0x01]);
    expect(Array.from(new EscPosEncoder().feed(3).build())).toEqual([0x1b, 0x64, 0x03]);
  });

  it('encodes paper cut commands (GS V m 0x00)', () => {
    // Partial cut: GS V 0x42 0x00
    expect(Array.from(new EscPosEncoder().cut('partial').build())).toEqual([
      0x1d, 0x56, 0x42, 0x00,
    ]);
    // Full cut: GS V 0x41 0x00
    expect(Array.from(new EscPosEncoder().cut('full').build())).toEqual([0x1d, 0x56, 0x41, 0x00]);
  });

  it('encodes cash drawer pulse command (ESC p m t1 t2)', () => {
    // Pin 2 (m=0), on 60ms (t1=30), off 120ms (t2=60)
    expect(Array.from(new EscPosEncoder().pulseDrawer(2, 60, 120).build())).toEqual([
      0x1b, 0x70, 0x00, 30, 60,
    ]);

    // Pin 5 (m=1), on 100ms (t1=50), off 200ms (t2=100)
    expect(Array.from(new EscPosEncoder().pulseDrawer(5, 100, 200).build())).toEqual([
      0x1b, 0x70, 0x01, 50, 100,
    ]);
  });

  it('encodes code page selection (ESC t n)', () => {
    expect(Array.from(new EscPosEncoder().setCodePage('CP437').build())).toEqual([
      0x1b,
      0x74,
      CODE_PAGES.CP437.escPosCode,
    ]); // 0

    expect(Array.from(new EscPosEncoder().setCodePage('CP858').build())).toEqual([
      0x1b,
      0x74,
      CODE_PAGES.CP858.escPosCode,
    ]); // 19

    expect(Array.from(new EscPosEncoder().setCodePage('CP1252').build())).toEqual([
      0x1b,
      0x74,
      CODE_PAGES.CP1252.escPosCode,
    ]); // 16
  });

  describe('Spanish Character Encoding (CP858 & CP1252)', () => {
    it('encodes accented vowels and ñ correctly in CP858', () => {
      // á -> 0xA0, é -> 0x82, í -> 0xA1, ó -> 0xA2, ú -> 0xA3, ñ -> 0xA4, Ñ -> 0xA5
      const text = 'Café y Piña';
      const encoded = encodeString(text, 'CP858');

      // 'C' (0x43), 'a' (0x61), 'f' (0x66), 'é' (0x82), ' ' (0x20), ...
      expect(encoded[3]).toBe(0x82); // é
      expect(encoded[9]).toBe(0xa4); // ñ
    });

    it('encodes inverted punctuation (¿, ¡) and currency symbols (€)', () => {
      const text = '¡Hola! ¿Precio? 50€';
      const encodedCP858 = encodeString(text, 'CP858');
      expect(encodedCP858[0]).toBe(0xad); // ¡
      expect(encodedCP858[7]).toBe(0xa8); // ¿
      expect(encodedCP858[encodedCP858.length - 1]).toBe(0xd5); // € in CP858

      const encodedCP1252 = encodeString(text, 'CP1252');
      expect(encodedCP1252[0]).toBe(0xa1); // ¡ in CP1252
      expect(encodedCP1252[7]).toBe(0xbf); // ¿ in CP1252
      expect(encodedCP1252[encodedCP1252.length - 1]).toBe(0x80); // € in CP1252
    });

    it('line() appends a newline (0x0A) after text', () => {
      const bytes = new EscPosEncoder().line('OK').build();
      expect(Array.from(bytes)).toEqual([0x4f, 0x4b, 0x0a]);
    });
  });

  describe('Barcode & QR Code Printing', () => {
    it('encodes CODE128 barcode with subset B selection and HRI', () => {
      const bytes = new EscPosEncoder().barcode('SALE-1234', 'CODE128', 64).build();

      const arr = Array.from(bytes);
      // GS h 64: [0x1D, 0x68, 64]
      expect(arr.slice(0, 3)).toEqual([0x1d, 0x68, 64]);
      // GS w 2: [0x1D, 0x77, 2]
      expect(arr.slice(3, 6)).toEqual([0x1d, 0x77, 2]);
      // GS H 2: [0x1D, 0x48, 2]
      expect(arr.slice(6, 9)).toEqual([0x1d, 0x48, 2]);
      // GS k 73 len {B 'S' 'A' ...
      expect(arr.slice(9, 15)).toEqual([0x1d, 0x6b, 73, 11, 0x7b, 0x42]);
    });

    it('encodes EAN13 barcode', () => {
      const bytes = new EscPosEncoder().barcode('7501234567890', 'EAN13', 50).build();

      const arr = Array.from(bytes);
      expect(arr.slice(0, 3)).toEqual([0x1d, 0x68, 50]);
      expect(arr.slice(9, 13)).toEqual([0x1d, 0x6b, 67, 13]);
    });

    it('encodes standard EPSON 2D QR Code sequence', () => {
      const qrData = 'https://pos-pwa.local/verify/123';
      const bytes = new EscPosEncoder().qrCode(qrData, 4, 'M').build();

      const arr = Array.from(bytes);
      // 1. Model 2 selection
      expect(arr.slice(0, 9)).toEqual([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
      // 2. Module size 4
      expect(arr.slice(9, 17)).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04]);
      // 3. Error correction 'M' (0x31)
      expect(arr.slice(17, 25)).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]);
      // 5. Last 8 bytes must be print symbol command: GS ( k 3 0 49 81 48
      expect(arr.slice(-8)).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
    });
  });

  describe('Property-based testing (fast-check)', () => {
    it('encodes any arbitrary unicode string without throwing and produces valid byte arrays', () => {
      fc.assert(
        fc.property(
          fc.fullUnicodeString(),
          fc.constantFrom<'CP437' | 'CP858' | 'CP1252'>('CP437', 'CP858', 'CP1252'),
          (str, cp) => {
            const encoder = new EscPosEncoder(cp);
            encoder.text(str).line();
            const bytes = encoder.build();

            expect(bytes).toBeInstanceOf(Uint8Array);
            expect(bytes.length).toBeGreaterThanOrEqual(1); // at least LF

            // Every element must be a valid byte between 0 and 255
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
