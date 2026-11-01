import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SalesHistoryView } from './sales-history-view';
import { SaleDetailDialog } from './sale-detail-dialog';
import type { Sale, Customer, User, Settings } from '@/domain';
import { DEFAULT_CURRENCY, v7 } from '@/domain';
import type { Repositories } from '@/data/repositories';

const mockCashierId = v7();
const mockCustomerId = v7();

const mockUser: User = {
  id: mockCashierId,
  name: 'María Cajera',
  role: 'cashier',
  active: true,
  pin: { hash: 'hash', salt: 'salt', iterations: 1000 },
  version: 1,
  updatedAt: new Date().toISOString(),
};

const mockCustomer: Customer = {
  id: mockCustomerId,
  name: 'Empresa ABC S.A.',
  taxId: 'ABC123456789',
  phone: '555-4321',
  version: 1,
  updatedAt: new Date().toISOString(),
  custom: {},
};

const mockSettings: Settings = {
  id: 'singleton',
  business: {
    name: 'Tienda Test',
    taxId: 'TIE999999999',
    address: 'Av. Principal 123',
    phone: '555-9876',
    footerText: 'Gracias por su compra',
  },
  currency: {
    code: 'USD',
    decimals: 2,
    symbol: '$',
  },
  pricesIncludeTax: true,
  requireShift: true,
  allowNegativeStock: true,
  maxDiscountBp: 1000,
  paymentMethods: [
    { id: 'cash', label: 'Efectivo', kind: 'cash', active: true, requireReference: false },
    { id: 'card', label: 'Tarjeta Débito', kind: 'card', active: true, requireReference: true },
  ],
  modules: {},
  receipt: {
    paperWidthMm: 80,
    template: null,
  },
  mode: 'local',
};

const nowIso = new Date().toISOString();
const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const mockSaleToday: Sale = {
  id: v7(),
  number: 'L01-000001',
  deviceId: v7(),
  shiftId: v7(),
  cashierId: mockCashierId,
  customerId: mockCustomerId,
  status: 'completed',
  lines: [
    {
      lineId: v7(),
      productId: v7(),
      sku: 'SKU-001',
      name: 'Producto A',
      qty: 1000,
      unitPrice: 1500,
      taxRateId: v7(),
      taxRateBp: 1600,
      taxableBase: 1293,
      tax: 207,
      lineBase: 1500,
      lineDiscount: 0,
      orderDiscountShare: 0,
      lineTotal: 1500,
      custom: {},
    },
  ],
  totals: {
    subtotal: 1500,
    lineDiscounts: 0,
    orderDiscount: 0,
    tax: 207,
    roundingAdjustment: 0,
    total: 1500,
    taxBreakdown: [
      {
        taxRateId: v7(),
        rateBp: 1600,
        base: 1293,
        tax: 207,
      },
    ],
  },
  payments: [
    {
      id: v7(),
      method: 'cash',
      amount: 1500,
      tendered: 2000,
      createdAt: nowIso,
    },
  ],
  change: 500,
  pricesIncludeTax: true,
  currency: 'USD',
  custom: {},
  createdAt: nowIso,
  completedAt: nowIso,
  schemaVersion: 1,
};

const mockSaleYesterday: Sale = {
  id: v7(),
  number: 'L01-000002',
  deviceId: v7(),
  shiftId: v7(),
  cashierId: mockCashierId,
  customerId: null,
  status: 'completed',
  lines: [
    {
      lineId: v7(),
      productId: v7(),
      sku: 'SKU-002',
      name: 'Producto B',
      qty: 2000,
      unitPrice: 2000,
      taxRateId: v7(),
      taxRateBp: 1600,
      taxableBase: 3448,
      tax: 552,
      lineBase: 4000,
      lineDiscount: 0,
      orderDiscountShare: 0,
      lineTotal: 4000,
      custom: {},
    },
  ],
  totals: {
    subtotal: 4000,
    lineDiscounts: 0,
    orderDiscount: 0,
    tax: 552,
    roundingAdjustment: 0,
    total: 4000,
    taxBreakdown: [],
  },
  payments: [
    {
      id: v7(),
      method: 'card',
      amount: 4000,
      reference: 'AUTH-999',
      createdAt: yesterdayIso,
    },
  ],
  change: 0,
  pricesIncludeTax: true,
  currency: 'USD',
  custom: {},
  createdAt: yesterdayIso,
  completedAt: yesterdayIso,
  schemaVersion: 1,
};

describe('Sales History Feature (S5-T5)', () => {
  let mockSalesStore: Sale[] = [];
  let mockAuditLogs: unknown[] = [];
  let mockRepos: Repositories;

  beforeEach(() => {
    mockSalesStore = [mockSaleToday, mockSaleYesterday];
    mockAuditLogs = [];

    mockRepos = {
      sales: {
        getById: vi.fn(async (id) => mockSalesStore.find((s) => s.id === id) ?? null),
        getByNumber: vi.fn(async (num) => mockSalesStore.find((s) => s.number === num) ?? null),
        listByShift: vi.fn(async () => []),
        list: vi.fn(async (filter) => {
          let list = [...mockSalesStore];
          if (filter?.startDate) {
            list = list.filter((s) => s.completedAt >= filter.startDate!);
          }
          if (filter?.endDate) {
            list = list.filter((s) => s.completedAt <= filter.endDate!);
          }
          if (filter?.search) {
            const q = filter.search.toLowerCase();
            list = list.filter((s) => s.number.toLowerCase().includes(q));
          }
          return list;
        }),
        save: vi.fn(async (sale) => {
          mockSalesStore.push(sale);
        }),
      },
      settings: {
        get: vi.fn(async () => mockSettings),
        save: vi.fn(),
      },
      users: {
        getById: vi.fn(async (id) => (id === mockCashierId ? mockUser : null)),
        listActive: vi.fn(async () => [mockUser]),
        create: vi.fn(),
        update: vi.fn(),
      },
      customers: {
        getById: vi.fn(async (id) => (id === mockCustomerId ? mockCustomer : null)),
        search: vi.fn(async () => [mockCustomer]),
        list: vi.fn(async () => [mockCustomer]),
        save: vi.fn(),
        delete: vi.fn(),
      },
      audit: {
        log: vi.fn(async (entry) => {
          mockAuditLogs.push(entry);
        }),
        listRecent: vi.fn(async () => []),
        list: vi.fn(async () => []),
      },
      categories: { getById: vi.fn(), list: vi.fn(async () => []), save: vi.fn(), delete: vi.fn() },
      taxRates: {
        getById: vi.fn(),
        listActive: vi.fn(async () => []),
        listAll: vi.fn(async () => []),
        save: vi.fn(),
        delete: vi.fn(),
      },
      products: {
        getById: vi.fn(),
        getByBarcode: vi.fn(),
        getBySku: vi.fn(),
        list: vi.fn(async () => []),
        listActive: vi.fn(async () => []),
        save: vi.fn(),
        delete: vi.fn(),
      },
      customFieldDefs: {
        getById: vi.fn(),
        listByEntity: vi.fn(async () => []),
        listAll: vi.fn(async () => []),
        save: vi.fn(),
        delete: vi.fn(),
      },
      shifts: {
        getCurrentOpen: vi.fn(async () => null),
        getById: vi.fn(),
        list: vi.fn(async () => []),
        open: vi.fn(),
        close: vi.fn(),
      },
      cashMovements: {
        add: vi.fn(),
        listByShift: vi.fn(async () => []),
      },
      outbox: {
        enqueue: vi.fn(),
        listPending: vi.fn(async () => []),
        countByStatus: vi.fn(async () => 0),
        markStatus: vi.fn(),
      },
      heldCarts: {
        getById: vi.fn(),
        list: vi.fn(async () => []),
        count: vi.fn(async () => 0),
        save: vi.fn(),
        delete: vi.fn(),
      },
      meta: {
        get: vi.fn(async () => null),
        set: vi.fn(),
      },
    };
  });

  describe('SalesHistoryView', () => {
    it('renders page header, search bar, and filters today by default', async () => {
      render(<SalesHistoryView repos={mockRepos} currentUser={mockUser} />);

      expect(screen.getByRole('heading', { name: /Historial de Ventas/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Buscar por folio o cliente/i)).toBeInTheDocument();

      // Today's sale should appear
      await waitFor(() => {
        expect(screen.getAllByText('L01-000001').length).toBeGreaterThanOrEqual(1);
      });
      // Cashier and customer resolved
      expect(screen.getAllByText('María Cajera').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Empresa ABC S.A.').length).toBeGreaterThanOrEqual(1);
    });

    it('switches date filter to "Todas" to show both today and yesterday sales', async () => {
      render(<SalesHistoryView repos={mockRepos} currentUser={mockUser} />);

      const allFilterBtn = screen.getByRole('button', { name: /Todas/i });
      fireEvent.click(allFilterBtn);

      await waitFor(() => {
        expect(screen.getAllByText('L01-000001').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('L01-000002').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('filters sales by search query input', async () => {
      render(<SalesHistoryView repos={mockRepos} currentUser={mockUser} />);

      // Switch to Todas first
      fireEvent.click(screen.getByRole('button', { name: /Todas/i }));
      await waitFor(() => {
        expect(screen.getAllByText('L01-000002').length).toBeGreaterThanOrEqual(1);
      });

      // Type search
      const searchInput = screen.getByPlaceholderText(/Buscar por folio o cliente/i);
      fireEvent.change(searchInput, { target: { value: '000002' } });

      await waitFor(() => {
        expect(screen.queryByText('L01-000001')).toBeNull();
        expect(screen.getAllByText('L01-000002').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('displays empty state when no sales match filters', async () => {
      render(<SalesHistoryView repos={mockRepos} currentUser={mockUser} />);

      const searchInput = screen.getByPlaceholderText(/Buscar por folio o cliente/i);
      fireEvent.change(searchInput, { target: { value: 'NO_MATCH_XYZ' } });

      await waitFor(() => {
        expect(screen.getByText(/No se encontraron ventas/i)).toBeInTheDocument();
      });
    });

    it('opens SaleDetailDialog when clicking on a sale row', async () => {
      render(<SalesHistoryView repos={mockRepos} currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getAllByText('L01-000001').length).toBeGreaterThanOrEqual(1);
      });

      // Click row
      const rows = screen.getAllByText('L01-000001');
      fireEvent.click(rows[0]!);

      // Detail dialog modal should open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Detalle de Venta')).toBeInTheDocument();
        expect(screen.getByText('Producto A')).toBeInTheDocument();
      });
    });

    it('reprints receipt and writes an audit log entry', async () => {
      render(<SalesHistoryView repos={mockRepos} currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getAllByText('L01-000001').length).toBeGreaterThanOrEqual(1);
      });

      const reprintBtns = screen.getAllByLabelText(/Reimprimir Recibo/i);
      fireEvent.click(reprintBtns[0]!);

      // Verify audit repository was invoked
      await waitFor(() => {
        expect(mockRepos.audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'sale:reprint',
            entity: 'sale',
            entityId: mockSaleToday.id,
          }),
        );
      });

      // Receipt modal should be opened
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('SaleDetailDialog Component', () => {
    it('renders all product lines, breakdown, payments, and handles close', async () => {
      const handleClose = vi.fn();
      const handleReprint = vi.fn();

      render(
        <SaleDetailDialog
          isOpen={true}
          onClose={handleClose}
          sale={mockSaleToday}
          cashierName="María Cajera"
          customerName="Empresa ABC S.A."
          currency={DEFAULT_CURRENCY}
          paymentMethodLabels={{ cash: 'Efectivo' }}
          onReprint={handleReprint}
        />,
      );

      // Check header, lines and totals
      expect(screen.getByText('Detalle de Venta')).toBeInTheDocument();
      expect(screen.getByText('Folio: L01-000001')).toBeInTheDocument();
      expect(screen.getByText('Producto A')).toBeInTheDocument();
      expect(screen.getByText(/Pagos Registrados/i)).toBeInTheDocument();
      expect(screen.getByText(/Vuelto \/ Cambio/i)).toBeInTheDocument();

      // Click reprint
      const reprintBtn = screen.getByRole('button', { name: /Reimprimir Recibo/i });
      await act(async () => {
        fireEvent.click(reprintBtn);
      });
      expect(handleReprint).toHaveBeenCalledWith(mockSaleToday);

      // Click close
      const closeBtns = screen.getAllByRole('button', { name: /Cerrar/i });
      fireEvent.click(closeBtns[0]!);
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
