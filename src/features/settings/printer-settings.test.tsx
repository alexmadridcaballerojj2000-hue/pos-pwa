import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PrinterConfig } from '@/domain';
import { PrinterSettings } from './printer-settings';
import { printerService } from '@/hardware';

vi.mock('@/hardware', () => ({
  printerService: {
    setConfig: vi.fn(),
    getConfig: vi.fn(),
    pairDevice: vi.fn().mockResolvedValue({ vendorId: 0x04b8, productId: 0x0202 }),
    testPrint: vi.fn().mockResolvedValue(undefined),
    openDrawer: vi.fn().mockResolvedValue(undefined),
    isHardwareSupported: vi.fn().mockReturnValue(true),
  },
  DEFAULT_PRINTER_CONFIG: {
    driver: 'browser',
    paperWidthMm: 80,
    codePage: 'CP858',
    autoCut: true,
    openDrawer: false,
    drawerPin: 2,
    serialBaudRate: 9600,
  },
}));

describe('PrinterSettings', () => {
  const initialConfig: PrinterConfig = {
    driver: 'browser',
    paperWidthMm: 80,
    codePage: 'CP858',
    autoCut: true,
    openDrawer: false,
    drawerPin: 2,
  };

  let handleChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handleChange = vi.fn();
  });

  it('renders all 3 driver options and parameters', () => {
    render(<PrinterSettings config={initialConfig} onChange={handleChange} />);

    expect(screen.getByText('Navegador Web')).toBeInTheDocument();
    expect(screen.getByText(/WebUSB/i)).toBeInTheDocument();
    expect(screen.getByText(/WebSerial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ancho de Papel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Página de Códigos/i)).toBeInTheDocument();
  });

  it('switches driver to WebUSB when clicked', () => {
    render(<PrinterSettings config={initialConfig} onChange={handleChange} />);

    const usbBtn = screen.getByRole('button', { name: /WebUSB/i });
    fireEvent.click(usbBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        driver: 'usb',
      }),
    );
    expect(printerService.setConfig).toHaveBeenCalled();
  });

  it('changes paper width and triggers onChange', () => {
    render(<PrinterSettings config={initialConfig} onChange={handleChange} />);

    const select = screen.getByLabelText(/Ancho de Papel/i);
    fireEvent.change(select, { target: { value: '58' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        paperWidthMm: 58,
      }),
    );
  });

  it('changes codepage to CP1252', () => {
    render(<PrinterSettings config={initialConfig} onChange={handleChange} />);

    const select = screen.getByLabelText(/Página de Códigos/i);
    fireEvent.change(select, { target: { value: 'CP1252' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        codePage: 'CP1252',
      }),
    );
  });

  it('toggles autoCut and openDrawer', () => {
    render(<PrinterSettings config={initialConfig} onChange={handleChange} />);

    const cutCheckbox = screen.getByLabelText(/Corte automático de papel/i);
    fireEvent.click(cutCheckbox);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        autoCut: false,
      }),
    );

    const drawerCheckbox = screen.getByLabelText(/Abrir cajón de dinero automáticamente/i);
    fireEvent.click(drawerCheckbox);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        openDrawer: true,
      }),
    );
  });

  it('calls printerService.testPrint and shows success message', async () => {
    render(<PrinterSettings config={initialConfig} onChange={handleChange} />);

    const testBtn = screen.getByRole('button', { name: /Imprimir Ticket de Prueba/i });
    fireEvent.click(testBtn);

    expect(printerService.testPrint).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Comando enviado con éxito/i)).toBeInTheDocument();
    });
  });

  it('calls printerService.openDrawer and shows success message', async () => {
    render(<PrinterSettings config={initialConfig} onChange={handleChange} />);

    const drawerBtn = screen.getByRole('button', { name: /Probar Apertura de Cajón/i });
    fireEvent.click(drawerBtn);

    expect(printerService.openDrawer).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Pulso de apertura enviado al cajón/i)).toBeInTheDocument();
    });
  });

  it('shows pairing button and pairs USB device when driver is usb', async () => {
    const usbConfig: PrinterConfig = {
      ...initialConfig,
      driver: 'usb',
    };

    render(<PrinterSettings config={usbConfig} onChange={handleChange} />);

    const pairBtn = screen.getByRole('button', { name: /Vincular Impresora USB/i });
    expect(pairBtn).toBeInTheDocument();

    fireEvent.click(pairBtn);

    expect(printerService.pairDevice).toHaveBeenCalledWith('usb');

    await waitFor(() => {
      expect(screen.getByText(/Dispositivo vinculado: 0x04b8:0x0202/i)).toBeInTheDocument();
    });
  });
});
