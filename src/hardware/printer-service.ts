import type { ReceiptDoc, PrinterConfig } from '@/domain';
import type { ReceiptPrinter, PrinterStatus, PrinterTransport } from './types';
import { BrowserPrinter, browserPrinter } from './browser-printer';
import { EscPosPrinter } from './escpos-printer';
import { WebUsbTransport } from './transports/web-usb';
import { WebSerialTransport } from './transports/web-serial';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  driver: 'browser',
  paperWidthMm: 80,
  codePage: 'CP858',
  autoCut: true,
  openDrawer: false,
  drawerPin: 2,
  serialBaudRate: 9600,
};

/**
 * PrinterService: high-level coordinator that manages printer driver selection,
 * hardware pairing, ESC/POS rendering and automatic fallback to browser printing
 * when hardware is disconnected or unsupported.
 */
export class PrinterService implements ReceiptPrinter {
  private config: PrinterConfig;
  private browserPrinter: BrowserPrinter;
  private usbTransport: WebUsbTransport;
  private serialTransport: WebSerialTransport;
  private escPosPrinter: EscPosPrinter | null = null;
  private activeTransport: PrinterTransport | null = null;

  getActiveTransport(): PrinterTransport | null {
    return this.activeTransport;
  }

  constructor(
    initialConfig: PrinterConfig = DEFAULT_PRINTER_CONFIG,
    options?: {
      browserPrinter?: BrowserPrinter;
      usbTransport?: WebUsbTransport;
      serialTransport?: WebSerialTransport;
    },
  ) {
    this.config = { ...initialConfig };
    this.browserPrinter = options?.browserPrinter ?? browserPrinter;
    this.usbTransport =
      options?.usbTransport ??
      new WebUsbTransport({
        vendorId: this.config.usbVendorId,
        productId: this.config.usbProductId,
      });
    this.serialTransport =
      options?.serialTransport ??
      new WebSerialTransport({
        baudRate: this.config.serialBaudRate ?? 9600,
        usbVendorId: this.config.usbVendorId,
        usbProductId: this.config.usbProductId,
      });

    this.reconfigure();
  }

  setConfig(config: PrinterConfig): void {
    this.config = { ...config };
    this.reconfigure();
  }

  getConfig(): PrinterConfig {
    return { ...this.config };
  }

  private reconfigure(): void {
    if (this.config.driver === 'usb') {
      this.activeTransport = this.usbTransport;
      this.escPosPrinter = new EscPosPrinter(this.usbTransport, {
        paperWidthMm: this.config.paperWidthMm,
        codePage: this.config.codePage,
        autoCut: this.config.autoCut,
        openDrawer: this.config.openDrawer,
        drawerPin: this.config.drawerPin,
      });
    } else if (this.config.driver === 'serial') {
      this.activeTransport = this.serialTransport;
      this.escPosPrinter = new EscPosPrinter(this.serialTransport, {
        paperWidthMm: this.config.paperWidthMm,
        codePage: this.config.codePage,
        autoCut: this.config.autoCut,
        openDrawer: this.config.openDrawer,
        drawerPin: this.config.drawerPin,
      });
    } else {
      this.activeTransport = null;
      this.escPosPrinter = null;
    }
  }

  async pairDevice(driver: 'usb' | 'serial'): Promise<{ vendorId?: number; productId?: number }> {
    if (driver === 'usb') {
      await this.usbTransport.connect();
      const info = this.usbTransport.getDeviceInfo();
      if (info) {
        this.config.usbVendorId = info.vendorId;
        this.config.usbProductId = info.productId;
      }
      return info ?? {};
    } else {
      await this.serialTransport.connect();
      const info = this.serialTransport.getDeviceInfo();
      if (info?.usbVendorId && info?.usbProductId) {
        this.config.usbVendorId = info.usbVendorId;
        this.config.usbProductId = info.usbProductId;
      }
      return {
        vendorId: info?.usbVendorId,
        productId: info?.usbProductId,
      };
    }
  }

  async print(doc: ReceiptDoc): Promise<void> {
    // If browser mode, use browserPrinter directly
    if (this.config.driver === 'browser' || !this.escPosPrinter) {
      await this.browserPrinter.print(doc);
      return;
    }

    // Hardware mode (USB or Serial)
    try {
      await this.escPosPrinter.print(doc);
    } catch (err) {
      console.warn(
        `Hardware printer error (${this.config.driver}). Falling back to browser print dialog.`,
        err,
      );
      // Transparent fallback to BrowserPrinter so the user never loses a receipt
      await this.browserPrinter.print(doc);
    }
  }

  async openDrawer(): Promise<void> {
    if (this.escPosPrinter) {
      try {
        await this.escPosPrinter.openDrawer();
      } catch (err) {
        console.warn('Failed to pulse cash drawer:', err);
      }
    } else {
      await this.browserPrinter.openDrawer();
    }
  }

  async testPrint(): Promise<void> {
    if (this.config.driver === 'browser' || !this.escPosPrinter) {
      await this.browserPrinter.testPrint();
      return;
    }

    try {
      await this.escPosPrinter.testPrint();
    } catch (err) {
      console.warn('Hardware test print failed. Falling back to browser test print.', err);
      await this.browserPrinter.testPrint();
    }
  }

  async status(): Promise<PrinterStatus> {
    if (this.config.driver === 'browser' || !this.escPosPrinter) {
      return this.browserPrinter.status();
    }

    return this.escPosPrinter.status();
  }

  isHardwareSupported(type: 'usb' | 'serial'): boolean {
    return type === 'usb' ? this.usbTransport.isSupported() : this.serialTransport.isSupported();
  }
}

export const printerService = new PrinterService();
