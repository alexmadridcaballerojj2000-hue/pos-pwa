import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReceiptDoc, PrinterConfig } from '@/domain';
import type { PrinterTransport } from './types';
import { EscPosPrinter } from './escpos-printer';
import { BrowserPrinter } from './browser-printer';
import { PrinterService } from './printer-service';
import type { WebUsbTransport } from './transports/web-usb';
import type { WebSerialTransport } from './transports/web-serial';

describe('EscPosPrinter', () => {
  let mockTransport: PrinterTransport;
  let sentChunks: Uint8Array[];

  beforeEach(() => {
    sentChunks = [];
    mockTransport = {
      id: 'usb',
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      isSupported: vi.fn().mockReturnValue(true),
      getDeviceName: vi.fn().mockReturnValue('Mock Epson TM-T20III'),
      send: vi.fn().mockImplementation(async (data: Uint8Array) => {
        sentChunks.push(data);
      }),
    };
  });

  it('prints ReceiptDoc through transport with autoCut and drawer pulse', async () => {
    const printer = new EscPosPrinter(mockTransport, {
      paperWidthMm: 80,
      codePage: 'CP858',
      autoCut: true,
      openDrawer: true,
      drawerPin: 2,
    });

    const doc: ReceiptDoc = {
      paperWidthMm: 80,
      blocks: [
        { type: 'text', text: 'Mi Tienda', align: 'center', bold: true },
        { type: 'row', left: 'Producto A', right: '10,00 €' },
        { type: 'divider', char: '-' },
      ],
    };

    await printer.print(doc);

    expect(mockTransport.send).toHaveBeenCalledTimes(1);
    expect(sentChunks.length).toBe(1);
    const output = sentChunks[0]!;
    expect(output.length).toBeGreaterThan(0);
    // Should contain ESC @ (0x1b, 0x40)
    expect(output[0]).toBe(0x1b);
    expect(output[1]).toBe(0x40);
  });

  it('connects transport automatically if not connected', async () => {
    (mockTransport.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const printer = new EscPosPrinter(mockTransport);

    const doc: ReceiptDoc = {
      paperWidthMm: 80,
      blocks: [{ type: 'text', text: 'Hola' }],
    };

    await printer.print(doc);

    expect(mockTransport.connect).toHaveBeenCalledTimes(1);
    expect(mockTransport.send).toHaveBeenCalledTimes(1);
  });

  it('pulses cash drawer on demand', async () => {
    const printer = new EscPosPrinter(mockTransport, { drawerPin: 5 });
    await printer.openDrawer();

    expect(mockTransport.send).toHaveBeenCalledTimes(1);
    const output = sentChunks[0]!;
    // ESC p (0x1b, 0x70, 0x01, ...) for pin 5
    expect(output).toContain(0x1b);
    expect(output).toContain(0x70);
  });

  it('sends testPrint receipt', async () => {
    const printer = new EscPosPrinter(mockTransport);
    await printer.testPrint();

    expect(mockTransport.send).toHaveBeenCalledTimes(1);
    expect(sentChunks[0]!.length).toBeGreaterThan(50);
  });

  it('returns transport status accurately', async () => {
    const printer = new EscPosPrinter(mockTransport);
    const status = await printer.status();

    expect(status).toEqual({
      connected: true,
      type: 'usb',
      deviceName: 'Mock Epson TM-T20III',
      supported: true,
    });
  });
});

describe('PrinterService', () => {
  let mockBrowserPrinter: BrowserPrinter;
  let mockUsbTransport: WebUsbTransport;
  let mockSerialTransport: WebSerialTransport;

  beforeEach(() => {
    mockBrowserPrinter = {
      print: vi.fn().mockResolvedValue(undefined),
      openDrawer: vi.fn().mockResolvedValue(undefined),
      testPrint: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({
        connected: true,
        type: 'browser',
        deviceName: 'Navegador Web',
        supported: true,
      }),
    } as unknown as BrowserPrinter;

    mockUsbTransport = {
      id: 'usb',
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      isSupported: vi.fn().mockReturnValue(true),
      getDeviceName: vi.fn().mockReturnValue('Mock USB Thermal'),
      getDeviceInfo: vi.fn().mockReturnValue({ vendorId: 0x04b8, productId: 0x0202 }),
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebUsbTransport;

    mockSerialTransport = {
      id: 'serial',
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      isSupported: vi.fn().mockReturnValue(true),
      getDeviceName: vi.fn().mockReturnValue('Mock Serial Thermal'),
      getDeviceInfo: vi
        .fn()
        .mockReturnValue({ usbVendorId: 0x04b8, usbProductId: 0x0202, baudRate: 9600 }),
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebSerialTransport;
  });

  it('delegates to BrowserPrinter when driver is browser', async () => {
    const service = new PrinterService(
      {
        driver: 'browser',
        paperWidthMm: 80,
        codePage: 'CP858',
        autoCut: true,
        openDrawer: false,
        drawerPin: 2,
      },
      {
        browserPrinter: mockBrowserPrinter,
        usbTransport: mockUsbTransport,
        serialTransport: mockSerialTransport,
      },
    );

    const doc: ReceiptDoc = { paperWidthMm: 80, blocks: [] };
    await service.print(doc);

    expect(mockBrowserPrinter.print).toHaveBeenCalledWith(doc);
    expect(mockUsbTransport.send).not.toHaveBeenCalled();
  });

  it('delegates to EscPosPrinter when driver is usb', async () => {
    const service = new PrinterService(
      {
        driver: 'usb',
        paperWidthMm: 80,
        codePage: 'CP858',
        autoCut: true,
        openDrawer: false,
        drawerPin: 2,
      },
      {
        browserPrinter: mockBrowserPrinter,
        usbTransport: mockUsbTransport,
        serialTransport: mockSerialTransport,
      },
    );

    const doc: ReceiptDoc = { paperWidthMm: 80, blocks: [] };
    await service.print(doc);

    expect(mockUsbTransport.send).toHaveBeenCalledTimes(1);
    expect(mockBrowserPrinter.print).not.toHaveBeenCalled();
  });

  it('transparently falls back to BrowserPrinter if hardware print fails', async () => {
    (mockUsbTransport.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('USB connection lost'),
    );

    const service = new PrinterService(
      {
        driver: 'usb',
        paperWidthMm: 80,
        codePage: 'CP858',
        autoCut: true,
        openDrawer: false,
        drawerPin: 2,
      },
      {
        browserPrinter: mockBrowserPrinter,
        usbTransport: mockUsbTransport,
        serialTransport: mockSerialTransport,
      },
    );

    const doc: ReceiptDoc = { paperWidthMm: 80, blocks: [{ type: 'text', text: 'Fallback Test' }] };

    // Should NOT throw
    await expect(service.print(doc)).resolves.not.toThrow();

    expect(mockUsbTransport.send).toHaveBeenCalledTimes(1);
    expect(mockBrowserPrinter.print).toHaveBeenCalledWith(doc);
  });

  it('switches driver dynamically via setConfig', async () => {
    const service = new PrinterService(
      {
        driver: 'browser',
        paperWidthMm: 80,
        codePage: 'CP858',
        autoCut: true,
        openDrawer: false,
        drawerPin: 2,
      },
      {
        browserPrinter: mockBrowserPrinter,
        usbTransport: mockUsbTransport,
        serialTransport: mockSerialTransport,
      },
    );

    const doc: ReceiptDoc = { paperWidthMm: 80, blocks: [] };
    await service.print(doc);
    expect(mockBrowserPrinter.print).toHaveBeenCalledTimes(1);

    const newConfig: PrinterConfig = {
      driver: 'serial',
      paperWidthMm: 58,
      codePage: 'CP1252',
      autoCut: true,
      openDrawer: true,
      drawerPin: 5,
    };
    service.setConfig(newConfig);

    await service.print(doc);
    expect(mockSerialTransport.send).toHaveBeenCalledTimes(1);
  });
});
