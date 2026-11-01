import type { PrinterTransport } from '../types';

export interface SerialPortWriterLike {
  write(data: Uint8Array): Promise<void>;
  releaseLock(): void;
}

export interface SerialPortLike {
  readable: unknown;
  writable: {
    getWriter(): SerialPortWriterLike;
  } | null;
  open(options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
  }): Promise<void>;
  close(): Promise<void>;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}

export interface WebSerialNavigator {
  serial?: {
    getPorts(): Promise<SerialPortLike[]>;
    requestPort(options?: {
      filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
    }): Promise<SerialPortLike>;
  };
}

export interface WebSerialOptions {
  baudRate?: number;
  usbVendorId?: number;
  usbProductId?: number;
  customNavigator?: WebSerialNavigator;
}

export class WebSerialTransport implements PrinterTransport {
  readonly id = 'serial' as const;
  private port: SerialPortLike | null = null;
  private isOpen = false;
  private baudRate: number;
  private targetVendorId?: number;
  private targetProductId?: number;
  private nav: WebSerialNavigator;

  constructor(options: WebSerialOptions = {}) {
    this.baudRate = options.baudRate ?? 9600;
    this.targetVendorId = options.usbVendorId;
    this.targetProductId = options.usbProductId;
    this.nav =
      options.customNavigator ??
      (typeof navigator !== 'undefined' ? (navigator as unknown as WebSerialNavigator) : {});
  }

  isSupported(): boolean {
    return Boolean(this.nav.serial && typeof this.nav.serial.requestPort === 'function');
  }

  isConnected(): boolean {
    return Boolean(this.port && this.isOpen);
  }

  getDeviceName(): string | undefined {
    if (!this.port) return undefined;
    const info = this.port.getInfo?.();
    if (info?.usbVendorId && info?.usbProductId) {
      return `Serial Port (${info.usbVendorId.toString(16).padStart(4, '0')}:${info.usbProductId.toString(16).padStart(4, '0')}) @ ${this.baudRate} bps`;
    }
    return `Serial Port @ ${this.baudRate} bps`;
  }

  getDeviceInfo(): { usbVendorId?: number; usbProductId?: number; baudRate: number } | null {
    if (!this.port) return null;
    const info = this.port.getInfo?.();
    return {
      usbVendorId: info?.usbVendorId,
      usbProductId: info?.usbProductId,
      baudRate: this.baudRate,
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected()) return;

    if (!this.isSupported()) {
      throw new Error('WebSerial API is not supported in this browser.');
    }

    const serial = this.nav.serial!;
    let selectedPort: SerialPortLike | null = null;

    // 1. Try to reconnect silently using remembered ports
    if (this.targetVendorId !== undefined && this.targetProductId !== undefined) {
      try {
        const availablePorts = await serial.getPorts();
        selectedPort =
          availablePorts.find((p) => {
            const info = p.getInfo?.();
            return (
              info?.usbVendorId === this.targetVendorId &&
              info?.usbProductId === this.targetProductId
            );
          }) ?? null;
      } catch {
        // Fallback to requestPort prompt
      }
    }

    // 2. If not found, prompt user
    if (!selectedPort) {
      selectedPort = await serial.requestPort();
    }

    if (!selectedPort) {
      throw new Error('No Serial port was selected.');
    }

    // 3. Open port
    await selectedPort.open({
      baudRate: this.baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });

    this.port = selectedPort;
    this.isOpen = true;

    const info = selectedPort.getInfo?.();
    if (info?.usbVendorId) this.targetVendorId = info.usbVendorId;
    if (info?.usbProductId) this.targetProductId = info.usbProductId;
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.port || !this.isOpen || !this.port.writable) {
      throw new Error('Serial Port is not connected or writable. Call connect() first.');
    }

    const writer = this.port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async disconnect(): Promise<void> {
    if (!this.port) return;

    try {
      if (this.isOpen) {
        await this.port.close();
      }
    } finally {
      this.port = null;
      this.isOpen = false;
    }
  }
}
