import { type CodePage, CODE_PAGES, encodeString } from './codepages';

export type EscPosAlign = 'left' | 'center' | 'right';
export type EscPosCutMode = 'full' | 'partial';
export type EscPosBarcodeType = 'CODE128' | 'EAN13';
export type EscPosQrEcLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * Pure TypeScript ESC/POS binary command encoder.
 * Provides a fluent, chainable API that outputs a complete Uint8Array
 * ready to be transmitted over WebUSB, WebSerial or TCP/WebSocket.
 *
 * Implements SPEC §9 hardware commands:
 * - init (ESC @)
 * - alignment (ESC a)
 * - bold (ESC E)
 * - text sizing (GS !)
 * - paper cut (GS V)
 * - cash drawer pulse (ESC p)
 * - code page selection (ESC t)
 * - barcodes (GS k)
 * - QR codes (GS ( k)
 */
export class EscPosEncoder {
  private buffer: number[] = [];
  private currentCodePage: CodePage = 'CP858';

  constructor(initialCodePage: CodePage = 'CP858') {
    this.currentCodePage = initialCodePage;
  }

  /**
   * Initializes printer (clears print buffer and resets modes to defaults).
   * ESC @ [0x1B, 0x40]
   */
  init(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  /**
   * Selects justification / alignment.
   * ESC a n [0x1B, 0x61, n]
   * 0 = left, 1 = center, 2 = right
   */
  setAlign(align: EscPosAlign): this {
    const n = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, n);
    return this;
  }

  /**
   * Turns bold mode on or off.
   * ESC E n [0x1B, 0x45, n]
   */
  setBold(bold: boolean): this {
    this.buffer.push(0x1b, 0x45, bold ? 1 : 0);
    return this;
  }

  /**
   * Turns underline mode on or off.
   * ESC - n [0x1B, 0x2D, n]
   * 0 = off, 1 = 1-dot, 2 = 2-dot
   */
  setUnderline(mode: 0 | 1 | 2 = 1): this {
    this.buffer.push(0x1b, 0x2d, mode);
    return this;
  }

  /**
   * Sets character width and height multipliers (1..8).
   * GS ! n [0x1D, 0x21, n]
   * Bits 0-3: height, Bits 4-7: width
   */
  setSize(widthMultiplier = 1, heightMultiplier = 1): this {
    const w = Math.max(1, Math.min(8, Math.floor(widthMultiplier))) - 1;
    const h = Math.max(1, Math.min(8, Math.floor(heightMultiplier))) - 1;
    const n = (w << 4) | h;
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  /**
   * Feeds paper by n lines.
   * ESC d n [0x1B, 0x64, n]
   */
  feed(lines = 1): this {
    const n = Math.max(1, Math.min(255, Math.floor(lines)));
    this.buffer.push(0x1b, 0x64, n);
    return this;
  }

  /**
   * Cuts paper.
   * GS V m [0x1D, 0x56, m, 0x00]
   * m = 0x41 for full cut, 0x42 for partial cut
   */
  cut(mode: EscPosCutMode = 'partial'): this {
    const m = mode === 'full' ? 0x41 : 0x42;
    this.buffer.push(0x1d, 0x56, m, 0x00);
    return this;
  }

  /**
   * Generates a pulse to open the cash drawer.
   * ESC p m t1 t2 [0x1B, 0x70, m, t1, t2]
   * pin 2: m = 0; pin 5: m = 1
   * onMs / offMs in milliseconds (divided by 2 for the command byte)
   */
  pulseDrawer(pin: 2 | 5 = 2, onMs = 60, offMs = 120): this {
    const m = pin === 2 ? 0 : 1;
    const t1 = Math.max(1, Math.min(255, Math.floor(onMs / 2)));
    const t2 = Math.max(1, Math.min(255, Math.floor(offMs / 2)));
    this.buffer.push(0x1b, 0x70, m, t1, t2);
    return this;
  }

  /**
   * Selects the character code page.
   * ESC t n [0x1B, 0x74, n]
   */
  setCodePage(page: CodePage): this {
    this.currentCodePage = page;
    const n = CODE_PAGES[page].escPosCode;
    this.buffer.push(0x1b, 0x74, n);
    return this;
  }

  /**
   * Appends text encoded according to the active code page.
   */
  text(str: string): this {
    const bytes = encodeString(str, this.currentCodePage);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]!);
    }
    return this;
  }

  /**
   * Appends text followed by a newline (LF 0x0A).
   */
  line(str = ''): this {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  /**
   * Prints a 1D barcode (CODE128 or EAN13).
   * GS h (height), GS w (width), GS H (HRI position), GS k (print)
   */
  barcode(data: string, type: EscPosBarcodeType = 'CODE128', heightDots = 64): this {
    const height = Math.max(1, Math.min(255, heightDots));
    // 1. Set barcode height: GS h n
    this.buffer.push(0x1d, 0x68, height);
    // 2. Set barcode module width: GS w 2
    this.buffer.push(0x1d, 0x77, 2);
    // 3. Set HRI below barcode: GS H 2
    this.buffer.push(0x1d, 0x48, 2);

    if (type === 'CODE128') {
      // Code128 format B: GS k 73 len {B data}
      const dataBytes = encodeString(data, 'CP437');
      // Prefix with '{B' (0x7B, 0x42) to select CODE128 subset B
      const totalLen = dataBytes.length + 2;
      this.buffer.push(0x1d, 0x6b, 73, totalLen, 0x7b, 0x42);
      for (let i = 0; i < dataBytes.length; i++) {
        this.buffer.push(dataBytes[i]!);
      }
    } else if (type === 'EAN13') {
      // EAN13: GS k 67 len data
      const dataBytes = encodeString(data, 'CP437');
      this.buffer.push(0x1d, 0x6b, 67, dataBytes.length);
      for (let i = 0; i < dataBytes.length; i++) {
        this.buffer.push(dataBytes[i]!);
      }
    }

    return this;
  }

  /**
   * Prints a 2D QR Code using EPSON standard 2D barcode commands (GS ( k).
   */
  qrCode(data: string, moduleSize = 4, errorCorrection: EscPosQrEcLevel = 'M'): this {
    const size = Math.max(1, Math.min(16, moduleSize));
    const ecCode =
      errorCorrection === 'L'
        ? 0x30
        : errorCorrection === 'Q'
          ? 0x32
          : errorCorrection === 'H'
            ? 0x33
            : 0x31; // 'M'

    // 1. Select QR Model (Model 2): GS ( k 4 0 49 65 50 0
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);

    // 2. Set module size: GS ( k 3 0 49 67 size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);

    // 3. Set error correction level: GS ( k 3 0 49 69 ecCode
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecCode);

    // 4. Store data into symbol storage area: GS ( k pL pH 49 80 48 data
    const dataBytes = encodeString(data, 'CP437');
    const storeLen = dataBytes.length + 3;
    const pL = storeLen % 256;
    const pH = Math.floor(storeLen / 256);
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < dataBytes.length; i++) {
      this.buffer.push(dataBytes[i]!);
    }

    // 5. Print the symbol data: GS ( k 3 0 49 81 48
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

    return this;
  }

  /**
   * Appends raw bytes directly to the buffer.
   */
  raw(bytes: Uint8Array | number[]): this {
    if (bytes instanceof Uint8Array) {
      for (let i = 0; i < bytes.length; i++) {
        this.buffer.push(bytes[i]!);
      }
    } else {
      this.buffer.push(...bytes);
    }
    return this;
  }

  /**
   * Compiles the accumulated commands into an immutable Uint8Array.
   */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
