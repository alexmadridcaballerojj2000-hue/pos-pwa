import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebUsbTransport, type UsbDeviceLike, type WebUsbNavigator } from './web-usb';
import { WebSerialTransport, type SerialPortLike, type WebSerialNavigator } from './web-serial';

describe('Hardware Transports (S6-T3)', () => {
  describe('WebUsbTransport', () => {
    let mockUsbDevice: UsbDeviceLike;
    let mockNav: WebUsbNavigator;

    beforeEach(() => {
      mockUsbDevice = {
        vendorId: 0x04b8, // Epson
        productId: 0x0202, // TM-T20
        productName: 'Epson TM-T20 Thermal Printer',
        opened: false,
        configuration: {
          configurationValue: 1,
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [
                {
                  endpoints: [
                    { endpointNumber: 1, direction: 'out', type: 'bulk' },
                    { endpointNumber: 2, direction: 'in', type: 'bulk' },
                  ],
                },
              ],
            },
          ],
        },
        open: vi.fn(async function (this: UsbDeviceLike) {
          this.opened = true;
        }),
        selectConfiguration: vi.fn(async () => {}),
        claimInterface: vi.fn(async () => {}),
        releaseInterface: vi.fn(async () => {}),
        close: vi.fn(async function (this: UsbDeviceLike) {
          this.opened = false;
        }),
        transferOut: vi.fn(async () => ({ status: 'ok', bytesWritten: 10 })),
      };

      mockNav = {
        usb: {
          getDevices: vi.fn(async () => [mockUsbDevice]),
          requestDevice: vi.fn(async () => mockUsbDevice),
        },
      };
    });

    it('reports isSupported based on navigator.usb presence', () => {
      const supportedTransport = new WebUsbTransport({ customNavigator: mockNav });
      expect(supportedTransport.isSupported()).toBe(true);

      const unsupportedTransport = new WebUsbTransport({ customNavigator: {} });
      expect(unsupportedTransport.isSupported()).toBe(false);
    });

    it('connects via user prompt when no remembered device is specified', async () => {
      const transport = new WebUsbTransport({ customNavigator: mockNav });
      await transport.connect();

      expect(mockNav.usb?.requestDevice).toHaveBeenCalledTimes(1);
      expect(mockUsbDevice.open).toHaveBeenCalledTimes(1);
      expect(mockUsbDevice.claimInterface).toHaveBeenCalledWith(0);
      expect(transport.isConnected()).toBe(true);
      expect(transport.getDeviceName()).toBe('Epson TM-T20 Thermal Printer');
    });

    it('reconnects silently to remembered vendorId and productId', async () => {
      const transport = new WebUsbTransport({
        vendorId: 0x04b8,
        productId: 0x0202,
        customNavigator: mockNav,
      });

      await transport.connect();

      expect(mockNav.usb?.getDevices).toHaveBeenCalledTimes(1);
      expect(mockNav.usb?.requestDevice).not.toHaveBeenCalled();
      expect(transport.isConnected()).toBe(true);
    });

    it('transfers data through the OUT endpoint', async () => {
      const transport = new WebUsbTransport({ customNavigator: mockNav });
      await transport.connect();

      const testData = new Uint8Array([0x1b, 0x40, 0x0a]);
      await transport.send(testData);

      expect(mockUsbDevice.transferOut).toHaveBeenCalledWith(1, testData);
    });

    it('disconnects and releases the interface', async () => {
      const transport = new WebUsbTransport({ customNavigator: mockNav });
      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      await transport.disconnect();
      expect(mockUsbDevice.releaseInterface).toHaveBeenCalledWith(0);
      expect(mockUsbDevice.close).toHaveBeenCalledTimes(1);
      expect(transport.isConnected()).toBe(false);
    });

    it('throws when sending to disconnected printer', async () => {
      const transport = new WebUsbTransport({ customNavigator: mockNav });
      await expect(transport.send(new Uint8Array([1, 2]))).rejects.toThrow(
        /USB Printer is not connected/,
      );
    });
  });

  describe('WebSerialTransport', () => {
    let mockPort: SerialPortLike;
    let mockWriter: { write: ReturnType<typeof vi.fn>; releaseLock: ReturnType<typeof vi.fn> };
    let mockNav: WebSerialNavigator;

    beforeEach(() => {
      mockWriter = {
        write: vi.fn(async () => {}),
        releaseLock: vi.fn(),
      };

      mockPort = {
        readable: {},
        writable: {
          getWriter: vi.fn(() => mockWriter),
        },
        open: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
        getInfo: vi.fn(() => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 })),
      };

      mockNav = {
        serial: {
          getPorts: vi.fn(async () => [mockPort]),
          requestPort: vi.fn(async () => mockPort),
        },
      };
    });

    it('reports isSupported based on navigator.serial presence', () => {
      const supported = new WebSerialTransport({ customNavigator: mockNav });
      expect(supported.isSupported()).toBe(true);

      const unsupported = new WebSerialTransport({ customNavigator: {} });
      expect(unsupported.isSupported()).toBe(false);
    });

    it('connects to serial port with specified baud rate', async () => {
      const transport = new WebSerialTransport({ baudRate: 115200, customNavigator: mockNav });
      await transport.connect();

      expect(mockNav.serial?.requestPort).toHaveBeenCalledTimes(1);
      expect(mockPort.open).toHaveBeenCalledWith({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      });
      expect(transport.isConnected()).toBe(true);
      expect(transport.getDeviceName()).toContain('115200 bps');
    });

    it('reconnects silently to remembered vendor and product id', async () => {
      const transport = new WebSerialTransport({
        usbVendorId: 0x1a86,
        usbProductId: 0x7523,
        customNavigator: mockNav,
      });

      await transport.connect();

      expect(mockNav.serial?.getPorts).toHaveBeenCalledTimes(1);
      expect(mockNav.serial?.requestPort).not.toHaveBeenCalled();
      expect(transport.isConnected()).toBe(true);
    });

    it('writes data and properly releases writer lock in finally block', async () => {
      const transport = new WebSerialTransport({ customNavigator: mockNav });
      await transport.connect();

      const testData = new Uint8Array([0x1b, 0x40]);
      await transport.send(testData);

      expect(mockWriter.write).toHaveBeenCalledWith(testData);
      expect(mockWriter.releaseLock).toHaveBeenCalledTimes(1);
    });

    it('disconnects and closes port cleanly', async () => {
      const transport = new WebSerialTransport({ customNavigator: mockNav });
      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      await transport.disconnect();
      expect(mockPort.close).toHaveBeenCalledTimes(1);
      expect(transport.isConnected()).toBe(false);
    });

    it('throws when sending without active connection', async () => {
      const transport = new WebSerialTransport({ customNavigator: mockNav });
      await expect(transport.send(new Uint8Array([1, 2]))).rejects.toThrow(
        /Serial Port is not connected/,
      );
    });
  });
});
