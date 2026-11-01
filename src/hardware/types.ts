import type { ReceiptDoc } from '@/domain';

export type PrinterTransportType = 'browser' | 'usb' | 'serial';

export interface PrinterStatus {
  connected: boolean;
  type: PrinterTransportType;
  deviceName?: string;
  supported: boolean;
  error?: string;
}

export interface PrinterTransport {
  readonly id: PrinterTransportType;
  connect(): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  isSupported(): boolean;
  getDeviceName(): string | undefined;
}

export interface ReceiptPrinter {
  print(doc: ReceiptDoc): Promise<void>;
  openDrawer(): Promise<void>;
  testPrint(): Promise<void>;
  status(): Promise<PrinterStatus>;
}
