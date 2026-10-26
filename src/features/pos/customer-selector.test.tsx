import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { createRepositories, type Repositories } from '@/data/repositories';
import { CustomerSelectorDialog } from './customer-selector-dialog';
import { PosView } from './pos-view';
import type { Customer, Product, Settings, TaxRate, User } from '@/domain';
import { v7 } from '@/domain';

describe('POS Customer Selector & Quick Alta (S4-T5)', () => {
  let db: AppDatabase;
  let repos: Repositories;

  const mockCustomer1: Customer = {
    id: v7(),
    name: 'Ana García López',
    phone: '5511223344',
    taxId: 'GALA850101XYZ',
    email: 'ana@example.com',
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  const mockCustomer2: Customer = {
    id: v7(),
    name: 'Bernardo Morales',
    phone: '5599887766',
    taxId: 'MOBE900202ABC',
    email: 'bernardo@example.com',
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  const cashierUser: User = {
    id: v7(),
    name: 'Carlos Cajero',
    role: 'cashier',
    active: true,
    pin: { hash: 'h', salt: 's', iterations: 210000 },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const mockProduct: Product = {
    id: v7(),
    sku: 'SKU-001',
    name: 'Café Americano',
    barcodes: ['750100000001'],
    priceMinor: 4000,
    taxRateId: v7(),
    trackStock: false,
    unit: 'unit',
    allowFractional: false,
    active: true,
    custom: {},
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const mockTax: TaxRate = {
    id: mockProduct.taxRateId,
    name: 'IVA 16%',
    rateBp: 1600,
    active: true,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const mockSettings: Settings = {
    id: 'singleton',
    business: { name: 'Test Store' },
    currency: { code: 'MXN', decimals: 2, symbol: '$' },
    pricesIncludeTax: true,
    requireShift: false,
    allowNegativeStock: true,
    maxDiscountBp: 1000,
    paymentMethods: [{ method: 'cash', active: true }],
    modules: {},
    receipt: { paperWidthMm: 80, template: null },
    mode: 'local',
  };

  beforeEach(async () => {
    db = createAppDatabase(`test_pos_cust_${Date.now()}_${Math.random()}`);
    repos = createRepositories(db);

    await repos.customers.save(mockCustomer1);
    await repos.customers.save(mockCustomer2);
    await repos.settings.save(mockSettings);
    await repos.taxRates.save(mockTax);
    await repos.products.save(mockProduct);
  });

  describe('CustomerSelectorDialog Unit', () => {
    it('displays initial customer list and search filtering by name and taxId', async () => {
      let selected: Customer | null | undefined;
      let closed = false;

      render(
        <CustomerSelectorDialog
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          onSelectCustomer={(c) => {
            selected = c;
          }}
          customerRepo={repos.customers}
        />,
      );

      // Verify title and options
      expect(screen.getByRole('heading', { name: /seleccionar cliente/i })).toBeInTheDocument();
      expect(screen.getByText(/público general/i)).toBeInTheDocument();

      // Wait for customers to load
      await waitFor(() => {
        expect(screen.getByText('Ana García López')).toBeInTheDocument();
        expect(screen.getByText('Bernardo Morales')).toBeInTheDocument();
      });

      // Filter by taxId
      const searchInput = screen.getByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'GALA850101' } });

      await waitFor(() => {
        expect(screen.getByText('Ana García López')).toBeInTheDocument();
        expect(screen.queryByText('Bernardo Morales')).not.toBeInTheDocument();
      });

      // Select customer
      fireEvent.click(screen.getByText('Ana García López'));
      expect(selected?.id).toBe(mockCustomer1.id);
      expect(closed).toBe(true);
    });

    it('allows selecting público general / removing customer assignment', async () => {
      let selected: Customer | null | undefined;
      let closed = false;

      render(
        <CustomerSelectorDialog
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          currentCustomerId={mockCustomer1.id}
          onSelectCustomer={(c) => {
            selected = c;
          }}
          customerRepo={repos.customers}
        />,
      );

      // Select general customer
      const generalOption = screen.getByText(/público general/i);
      fireEvent.click(generalOption);

      expect(selected).toBeNull();
      expect(closed).toBe(true);
    });

    it('creates a new customer via quick alta and immediately assigns it', async () => {
      let selected: Customer | null | undefined;
      let closed = false;

      render(
        <CustomerSelectorDialog
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          onSelectCustomer={(c) => {
            selected = c;
          }}
          customerRepo={repos.customers}
        />,
      );

      // Switch to Quick Create tab
      const createTab = screen.getByRole('button', { name: /alta rápida/i });
      fireEvent.click(createTab);

      // Fill in required name and optional fields
      const nameInput = screen.getByLabelText(/nombre completo \*/i);
      const phoneInput = screen.getByLabelText(/teléfono/i);
      const taxIdInput = screen.getByLabelText(/rfc \/ nit/i);

      fireEvent.change(nameInput, { target: { value: 'Farmacia La Salud' } });
      fireEvent.change(phoneInput, { target: { value: '5544332211' } });
      fireEvent.change(taxIdInput, { target: { value: 'FSA990101ZZZ' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /guardar y asignar/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(selected).toBeDefined();
        expect(selected?.name).toBe('Farmacia La Salud');
        expect(selected?.phone).toBe('5544332211');
        expect(selected?.taxId).toBe('FSA990101ZZZ');
        expect(closed).toBe(true);
      });

      // Verify persisted in DB
      const inDb = await repos.customers.getById(selected!.id);
      expect(inDb).not.toBeNull();
      expect(inDb?.name).toBe('Farmacia La Salud');
    });

    it('validates that customer name is required in quick alta', async () => {
      render(
        <CustomerSelectorDialog
          isOpen={true}
          onClose={() => {}}
          onSelectCustomer={() => {}}
          customerRepo={repos.customers}
        />,
      );

      // Switch to Quick Create
      fireEvent.click(screen.getByRole('button', { name: /alta rápida/i }));

      // Submit with empty name
      fireEvent.click(screen.getByRole('button', { name: /guardar y asignar/i }));

      // Native required or form validation prevents empty save
      const nameInput = screen.getByLabelText(/nombre completo \*/i) as HTMLInputElement;
      expect(nameInput.checkValidity()).toBe(false);
    });
  });

  describe('PosView Customer Integration', () => {
    it('allows assigning and unassigning a customer in the POS cart', async () => {
      render(<PosView repos={repos} db={db} currentUser={cashierUser} />);

      // Wait for POS to load
      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      // Initial state: Público General
      const selectCustomerBtn = screen.getByRole('button', { name: /seleccionar cliente/i });
      expect(selectCustomerBtn).toBeInTheDocument();
      expect(screen.getByText('Público General')).toBeInTheDocument();

      // Open Customer Selector
      fireEvent.click(selectCustomerBtn);

      await waitFor(() => {
        expect(screen.getByText('Ana García López')).toBeInTheDocument();
      });

      // Select Ana García López
      fireEvent.click(screen.getByText('Ana García López'));

      // Cart now shows Ana García López
      await waitFor(() => {
        expect(screen.getByText('Ana García López')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /quitar cliente/i })).toBeInTheDocument();
      });

      // Click clear customer button ("X")
      const clearBtn = screen.getByRole('button', { name: /quitar cliente/i });
      fireEvent.click(clearBtn);

      // Reverts to Público General
      await waitFor(() => {
        expect(screen.getByText('Público General')).toBeInTheDocument();
        expect(screen.queryByText('Ana García López')).not.toBeInTheDocument();
      });
    });
  });
});
