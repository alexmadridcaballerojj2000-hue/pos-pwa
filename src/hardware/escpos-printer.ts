import type { ReceiptDoc } from '@/domain';
import { renderReceiptToEscPos, EscPosEncoder } from '@/domain';
import type { PrinterTransport, ReceiptPrinter, PrinterStatus } from './types';

export interface EscPosPrinterOptions {
  paperWidthMm: 58 | 80;
  codePage: 'CP858' | 'CP1252' | 'CP437';
  autoCut: boolean;
  openDrawer: boolean;
  drawerPin: 2 | 5;
}

/**
 * EscPosPrinter: wraps a PrinterTransport (USB or Serial) and renders
 * ReceiptDoc intermediate representations to ESC/POS binary streams.
 */
export class EscPosPrinter implements ReceiptPrinter {
  private transport: PrinterTransport;
  private options: EscPosPrinterOptions;

  constructor(transport: PrinterTransport, options?: Partial<EscPosPrinterOptions>) {
    this.transport = transport;
    this.options = {
      paperWidthMm: options?.paperWidthMm ?? 80,
      codePage: options?.codePage ?? 'CP858',
      autoCut: options?.autoCut ?? true,
      openDrawer: options?.openDrawer ?? false,
      drawerPin: options?.drawerPin ?? 2,
    };
  }

  setOptions(options: Partial<EscPosPrinterOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): EscPosPrinterOptions {
    return { ...this.options };
  }

  getTransport(): PrinterTransport {
    return this.transport;
  }

  async print(doc: ReceiptDoc): Promise<void> {
    if (!this.transport.isConnected()) {
      await this.transport.connect();
    }

    const columns = (doc.paperWidthMm || this.options.paperWidthMm) === 58 ? 32 : 48;
    const bytes = renderReceiptToEscPos(doc, {
      columns,
      codePage: this.options.codePage,
      autoCut: this.options.autoCut,
      openDrawer: this.options.openDrawer,
      drawerPin: this.options.drawerPin,
    });

    await this.transport.send(bytes);
  }

  async openDrawer(): Promise<void> {
    if (!this.transport.isConnected()) {
      await this.transport.connect();
    }

    const encoder = new EscPosEncoder();
    encoder.init().pulseDrawer(this.options.drawerPin);
    await this.transport.send(encoder.build());
  }

  async testPrint(): Promise<void> {
    const testDoc: ReceiptDoc = {
      paperWidthMm: this.options.paperWidthMm,
      blocks: [
        { type: 'text', text: 'TICKET DE PRUEBA', align: 'center', bold: true, size: 'large' },
        {
          type: 'text',
          text: `Impresora ESC/POS (${this.transport.id.toUpperCase()})`,
          align: 'center',
          size: 'small',
        },
        { type: 'divider', char: '=' },
        { type: 'row', left: 'Dispositivo:', right: this.transport.getDeviceName() ?? 'Genérico' },
        { type: 'row', left: 'Ancho papel:', right: `${this.options.paperWidthMm} mm` },
        { type: 'row', left: 'Página códigos:', right: this.options.codePage },
        { type: 'row', left: 'Corte automático:', right: this.options.autoCut ? 'Sí' : 'No' },
        { type: 'row', left: 'Pin cajón:', right: `Pin ${this.options.drawerPin}` },
        { type: 'row', left: 'Fecha y hora:', right: new Date().toLocaleString('es-ES') },
        { type: 'divider', char: '-' },
        { type: 'text', text: 'Prueba de caracteres españoles:', bold: true },
        { type: 'text', text: 'á é í ó ú - Á É Í Ó Ú - ñ Ñ - ¿ ? - ¡ ! - €' },
        { type: 'divider', char: '-' },
        { type: 'text', text: 'Código de barras de prueba:', align: 'center' },
        { type: 'barcode', data: '123456789012', format: 'CODE128' },
        { type: 'feed', lines: 1 },
        { type: 'text', text: 'Código QR de prueba:', align: 'center' },
        { type: 'qr', data: 'https://pos-pwa.app' },
        { type: 'divider', char: '=' },
        { type: 'text', text: '¡Calibración completada con éxito!', align: 'center' },
        { type: 'feed', lines: 2 },
      ],
    };

    await this.print(testDoc);
  }

  async status(): Promise<PrinterStatus> {
    return {
      connected: this.transport.isConnected(),
      type: this.transport.id,
      deviceName: this.transport.getDeviceName(),
      supported: this.transport.isSupported(),
    };
  }
}
