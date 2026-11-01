import type { PrinterTransport } from '../types';

export interface UsbEndpointLike {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
}

export interface UsbAlternateLike {
  endpoints: UsbEndpointLike[];
}

export interface UsbInterfaceLike {
  interfaceNumber: number;
  alternates: UsbAlternateLike[];
}

export interface UsbConfigurationLike {
  configurationValue: number;
  interfaces: UsbInterfaceLike[];
}

export interface UsbDeviceLike {
  vendorId: number;
  productId: number;
  productName?: string;
  opened: boolean;
  configuration: UsbConfigurationLike | null;
  open(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  close(): Promise<void>;
  transferOut(
    endpointNumber: number,
    data: BufferSource,
  ): Promise<{ status: string; bytesWritten?: number }>;
}

export interface WebUsbNavigator {
  usb?: {
    getDevices(): Promise<UsbDeviceLike[]>;
    requestDevice(options: {
      filters: Array<{ vendorId?: number; productId?: number }>;
    }): Promise<UsbDeviceLike>;
  };
}

export interface WebUsbOptions {
  vendorId?: number;
  productId?: number;
  customNavigator?: WebUsbNavigator;
}

export class WebUsbTransport implements PrinterTransport {
  readonly id = 'usb' as const;
  private device: UsbDeviceLike | null = null;
  private interfaceNumber = 0;
  private endpointNumber = 1;
  private targetVendorId?: number;
  private targetProductId?: number;
  private nav: WebUsbNavigator;

  constructor(options: WebUsbOptions = {}) {
    this.targetVendorId = options.vendorId;
    this.targetProductId = options.productId;
    this.nav =
      options.customNavigator ??
      (typeof navigator !== 'undefined' ? (navigator as unknown as WebUsbNavigator) : {});
  }

  isSupported(): boolean {
    return Boolean(this.nav.usb && typeof this.nav.usb.requestDevice === 'function');
  }

  isConnected(): boolean {
    return Boolean(this.device && this.device.opened);
  }

  getDeviceName(): string | undefined {
    if (!this.device) return undefined;
    if (this.device.productName) return this.device.productName;
    return `USB Device (${this.device.vendorId.toString(16).padStart(4, '0')}:${this.device.productId.toString(16).padStart(4, '0')})`;
  }

  getDeviceInfo(): { vendorId: number; productId: number } | null {
    if (!this.device) return null;
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected()) return;

    if (!this.isSupported()) {
      throw new Error('WebUSB API is not supported in this browser.');
    }

    const usb = this.nav.usb!;
    let selectedDevice: UsbDeviceLike | null = null;

    // 1. Try to reconnect silently using remembered vendorId & productId if available
    if (this.targetVendorId !== undefined && this.targetProductId !== undefined) {
      try {
        const pairedDevices = await usb.getDevices();
        selectedDevice =
          pairedDevices.find(
            (d) => d.vendorId === this.targetVendorId && d.productId === this.targetProductId,
          ) ?? null;
      } catch {
        // Fallback to requestDevice prompt
      }
    }

    // 2. If not previously paired, prompt user to pair
    if (!selectedDevice) {
      selectedDevice = await usb.requestDevice({ filters: [] });
    }

    if (!selectedDevice) {
      throw new Error('No USB printer was selected.');
    }

    // 3. Open connection
    await selectedDevice.open();

    // 4. Select configuration
    if (!selectedDevice.configuration) {
      await selectedDevice.selectConfiguration(1);
    }

    // 5. Locate bulk OUT endpoint
    let foundInterface = 0;
    let foundEndpoint = 1;
    let endpointFound = false;

    if (selectedDevice.configuration) {
      for (const iface of selectedDevice.configuration.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out') {
              foundInterface = iface.interfaceNumber;
              foundEndpoint = ep.endpointNumber;
              endpointFound = true;
              break;
            }
          }
          if (endpointFound) break;
        }
        if (endpointFound) break;
      }
    }

    this.interfaceNumber = foundInterface;
    this.endpointNumber = foundEndpoint;

    // 6. Claim the interface
    await selectedDevice.claimInterface(this.interfaceNumber);

    this.device = selectedDevice;
    this.targetVendorId = selectedDevice.vendorId;
    this.targetProductId = selectedDevice.productId;
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.device || !this.device.opened) {
      throw new Error('USB Printer is not connected. Call connect() first.');
    }

    // Transmit in chunks if data is large (standard ESC/POS USB packets are up to 4096 bytes)
    const chunkSize = 4096;
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);
      await this.device.transferOut(this.endpointNumber, chunk);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.device) return;

    try {
      if (this.device.opened) {
        await this.device.releaseInterface(this.interfaceNumber);
        await this.device.close();
      }
    } finally {
      this.device = null;
    }
  }
}
