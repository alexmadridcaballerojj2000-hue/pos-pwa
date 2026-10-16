import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { DexieCustomerRepository } from '@/data/repositories';
import { CustomerDialog } from './customer-dialog';
import { CustomersView } from './customers-view';
import type { Customer, CustomFieldDef } from '@/domain';

describe('Customer CRUD & Directory (S3-T6)', () => {
  let db: AppDatabase;
  let customerRepo: DexieCustomerRepository;

  const mockCustomDefs: CustomFieldDef[] = [
    {
      id: 'field-cust-1',
      entity: 'customer',
      key: 'credit_days',
      label: 'Días de Crédito',
      type: 'number',
      required: false,
      showOn: ['form'],
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    db = createAppDatabase(`test_cust_${Date.now()}_${Math.random()}`);
    customerRepo = new DexieCustomerRepository(db);
  });

  it('CustomerDialog: validates name requirement, email, and collects custom fields', async () => {
    let savedCustomer: Customer | null = null;

    render(
      <CustomerDialog
        isOpen={true}
        onClose={() => {}}
        onSave={async (c) => {
          savedCustomer = c;
        }}
        customFieldDefs={mockCustomDefs}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Nuevo Cliente' })).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByLabelText(/nombre completo \/ razón social/i);
    const phoneInput = screen.getByLabelText(/teléfono de contacto/i);
    const emailInput = screen.getByLabelText(/correo electrónico/i);
    const taxIdInput = screen.getByLabelText(/rfc \/ identificación fiscal/i);
    const addressInput = screen.getByLabelText(/dirección \/ domicilio/i);
    const creditDaysInput = screen.getByLabelText(/días de crédito/i);

    fireEvent.change(nameInput, { target: { value: 'Comercializadora del Norte S.A.' } });
    fireEvent.change(phoneInput, { target: { value: '5512345678' } });
    fireEvent.change(emailInput, { target: { value: 'contacto@elnorte.com' } });
    fireEvent.change(taxIdInput, { target: { value: 'CNO990101XYZ' } });
    fireEvent.change(addressInput, { target: { value: 'Av. Hidalgo 100' } });
    fireEvent.change(creditDaysInput, { target: { value: '30' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(savedCustomer).not.toBeNull();
      expect(savedCustomer?.name).toBe('Comercializadora del Norte S.A.');
      expect(savedCustomer?.phone).toBe('5512345678');
      expect(savedCustomer?.email).toBe('contacto@elnorte.com');
      expect(savedCustomer?.taxId).toBe('CNO990101XYZ');
      expect(savedCustomer?.address).toBe('Av. Hidalgo 100');
      expect(savedCustomer?.custom?.credit_days).toBe(30);
    });
  });

  it('DexieCustomerRepository: saves, searches by name, phone and taxId, and deletes', async () => {
    const cust1: Customer = {
      id: 'c1',
      name: 'María González',
      phone: '5598765432',
      email: 'maria@example.com',
      taxId: 'GOMA850202111',
      address: 'Calle Juárez 45',
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    const cust2: Customer = {
      id: 'c2',
      name: 'Roberto Gómez',
      phone: '3311223344',
      taxId: 'GOMA900101222',
      custom: {},
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await customerRepo.save(cust1);
    await customerRepo.save(cust2);

    // Search by name substring
    const byName = await customerRepo.search('María');
    expect(byName).toHaveLength(1);
    expect(byName[0]?.id).toBe('c1');

    // Search by phone
    const byPhone = await customerRepo.search('3311223344');
    expect(byPhone).toHaveLength(1);
    expect(byPhone[0]?.id).toBe('c2');

    // Search by taxId substring
    const byTaxId = await customerRepo.search('850202');
    expect(byTaxId).toHaveLength(1);
    expect(byTaxId[0]?.id).toBe('c1');

    // Delete
    await customerRepo.delete('c1');
    expect(await customerRepo.getById('c1')).toBeNull();
  });

  it('CustomersView: renders directory and opens creation dialog', async () => {
    render(<CustomersView />);

    expect(screen.getByRole('heading', { name: /clientes/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/buscar cliente por nombre, teléfono, rfc o correo/i),
    ).toBeInTheDocument();

    const newBtn = screen.getByRole('button', { name: /nuevo cliente/i });
    fireEvent.click(newBtn);

    expect(await screen.findByRole('heading', { name: 'Nuevo Cliente' })).toBeInTheDocument();
  });
});
