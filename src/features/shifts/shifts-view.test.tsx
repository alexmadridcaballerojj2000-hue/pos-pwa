import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/data/db';
import { useAuthStore } from '@/features/auth/auth-store';
import { printerService } from '@/hardware';
import { ShiftsView } from './shifts-view';
import { openShift } from './shift-operations';
import { type User, type UUID, v7 } from '@/domain';

vi.mock('@/hardware', () => ({
  printerService: {
    print: vi.fn().mockResolvedValue(true),
    setConfig: vi.fn(),
  },
  DEFAULT_PRINTER_CONFIG: {
    driver: 'browser',
    paperWidthMm: 80,
    codePage: 'cp858',
    autoCut: true,
    openDrawer: false,
    drawerPin: 2,
    baudRate: 9600,
  },
}));

describe('ShiftsView and Shift Management (S7-T2, S7-T3, S7-T4)', () => {
  const cashierId: UUID = '018f0000-0000-7000-8000-000000000001' as UUID;
  const mockCashier: User = {
    id: cashierId,
    name: 'Carlos Cajero',
    role: 'cashier',
    active: true,
    pinHash: '1234',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.shifts.clear();
    await db.cashMovements.clear();
    await db.sales.clear();
    await db.users.clear();
    await db.settings.clear();
    await db.meta.clear();

    await db.users.add(mockCashier);
    await db.settings.add({
      id: 'settings_main',
      businessName: 'Don Pepe Abarrotes',
      taxId: 'PEP990101XYZ',
      address: 'Calle Mayor 123',
      phone: '555-9876',
      currency: { code: 'MXN', decimals: 2, symbol: '$' },
      requireShift: true,
      printer: {
        driver: 'browser',
        paperWidthMm: 80,
        codePage: 'cp858',
        autoCut: true,
        openDrawer: false,
        drawerPin: 2,
        baudRate: 9600,
      },
      updatedAt: '2026-11-01T10:00:00.000Z',
    });

    useAuthStore.setState({
      currentUser: mockCashier,
      isAuthenticated: true,
    });
  });

  it('renders empty state when no shift is open and allows opening a new shift', async () => {
    const user = userEvent.setup();
    render(<ShiftsView />);

    await waitFor(() => {
      expect(screen.getByText(/No hay turno abierto actualmente/i)).toBeInTheDocument();
    });

    // Click "Abrir Turno"
    const openBtn = screen.getAllByRole('button', { name: /Abrir.*Turno/i })[0]!;
    await user.click(openBtn);

    // Dialog opens
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Fondo Inicial de Caja/i)).toBeInTheDocument();

    // Select 200 quick chip
    const chip200 = screen.getByRole('button', { name: /^200[,.]/i });
    await user.click(chip200);

    // Submit form
    const submitBtn = screen.getAllByRole('button', { name: /Abrir Turno/i }).pop()!;
    await user.click(submitBtn);

    // Verify dialog closes and active shift is displayed
    await waitFor(async () => {
      const openShiftInDb = await db.shifts.where('status').equals('open').first();
      expect(openShiftInDb).toBeDefined();
      expect(openShiftInDb?.openingFloat).toBe(20000); // $200.00
    });

    await waitFor(() => {
      expect(screen.getByText(/Turno Activo/i)).toBeInTheDocument();
      expect(screen.getAllByText(/200[,.]00/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('records cash in and cash out movements and updates shift summary', async () => {
    const user = userEvent.setup();
    // Open a shift first
    await openShift(db, { cashierId, openingFloat: 50000 }); // $500.00

    render(<ShiftsView />);

    await waitFor(() => {
      expect(screen.getByText(/Turno Activo/i)).toBeInTheDocument();
    });

    // Click "Entrada de Efectivo"
    const cashInBtn = screen.getByRole('button', { name: /Entrada de Efectivo/i });
    await user.click(cashInBtn);

    // Dialog opens
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const amountInput = screen.getByLabelText(/Importe/i);
    await user.type(amountInput, '150');

    // Click preset reason
    const presetBtn = screen.getByRole('button', { name: /Aportación de cambio/i });
    await user.click(presetBtn);

    // Submit
    const submitInBtn = screen.getByRole('button', { name: /Registrar Entrada/i });
    await user.click(submitInBtn);

    // Check DB
    await waitFor(async () => {
      const movements = await db.cashMovements.toArray();
      expect(movements).toHaveLength(1);
      expect(movements[0]?.type).toBe('in');
      expect(movements[0]?.amount).toBe(15000); // $150.00
    });

    // Check updated expected cash: 500 + 150 = 650
    await waitFor(() => {
      expect(screen.getByText(/650[,.]00/i)).toBeInTheDocument();
      expect(screen.getByText(/Aportación de cambio/i)).toBeInTheDocument();
    });
  });

  it('performs partial X-report print from active shift card', async () => {
    const user = userEvent.setup();
    await openShift(db, { cashierId, openingFloat: 30000 }); // $300.00

    render(<ShiftsView />);

    await waitFor(() => {
      expect(screen.getByText(/Turno Activo/i)).toBeInTheDocument();
    });

    const xReportBtn = screen.getByRole('button', { name: /Corte Parcial/i });
    await user.click(xReportBtn);

    await waitFor(() => {
      expect(printerService.print).toHaveBeenCalledTimes(1);
    });

    // Validate the printed ReceiptDoc was partial X-Report
    const calledDoc = vi.mocked(printerService.print).mock.calls[0]![0];
    const textBlocks = calledDoc.blocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text);
    expect(textBlocks).toContain('CORTE PARCIAL (REPORTE X)');
  });

  it('closes active shift with blind count and reconciles difference', async () => {
    const user = userEvent.setup();
    const shift = await openShift(db, { cashierId, openingFloat: 50000 }); // $500.00

    // Add cash sale of $100.00
    await db.sales.add({
      id: v7(),
      number: 'L01-000001',
      deviceId: shift.deviceId,
      shiftId: shift.id,
      cashierId,
      customerId: null,
      status: 'completed',
      lines: [],
      totals: {
        subtotal: 10000,
        lineDiscounts: 0,
        orderDiscount: 0,
        totalDiscount: 0,
        tax: 0,
        total: 10000,
        taxBreakdown: [],
      },
      payments: [{ method: 'cash', amount: 10000 }],
      change: 0,
      pricesIncludeTax: true,
      completedAt: '2026-11-01T12:00:00.000Z',
      receiptPrinted: false,
    });

    render(<ShiftsView />);

    await waitFor(() => {
      expect(screen.getByText(/Turno Activo/i)).toBeInTheDocument();
    });

    // Click "Cerrar Turno"
    const closeBtn = screen.getByRole('button', { name: /Cerrar Turno/i });
    await user.click(closeBtn);

    // Close Dialog opens
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Type counted cash: 620.00 (expected: 500 + 100 = 600, so $20 overage)
    const countInput = screen.getByLabelText(/Efectivo Contado/i);
    await user.type(countInput, '620');

    // Confirm close
    const confirmCloseBtn = screen.getByRole('button', { name: /Confirmar Cierre de Turno/i });
    await user.click(confirmCloseBtn);

    // Reconciliation screen shows up
    await waitFor(() => {
      expect(screen.getByText(/Sobrante en Caja/i)).toBeInTheDocument();
    });

    // Click "Imprimir Reporte"
    const printZBtn = screen.getByRole('button', { name: /Imprimir Reporte/i });
    await user.click(printZBtn);

    expect(printerService.print).toHaveBeenCalledTimes(1);
    const zDoc = vi.mocked(printerService.print).mock.calls[0]![0];
    const textBlocks = zDoc.blocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text);
    expect(textBlocks).toContain('CORTE DE CAJA (REPORTE Z)');

    // Finalize
    const finalizeBtn = screen.getByRole('button', { name: /Finalizar y Salir/i });
    await user.click(finalizeBtn);

    // Verify shift is closed and displayed in history
    await waitFor(() => {
      expect(screen.getByText(/No hay turno abierto actualmente/i)).toBeInTheDocument();
      expect(screen.getByText(/Historial de Turnos/i)).toBeInTheDocument();
    });
  });
});
