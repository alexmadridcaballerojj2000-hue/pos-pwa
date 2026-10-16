import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { DexieSettingsRepository } from '@/data/repositories';
import { SettingsView } from './settings-view';
import type { Settings } from '@/domain';

describe('Settings Management (S3-T7)', () => {
  let db: AppDatabase;
  let settingsRepo: DexieSettingsRepository;

  const initialSettings: Settings = {
    id: 'singleton',
    business: {
      name: 'Abarrotes Don Pepe',
      taxId: 'PEPD800101XYZ',
      address: 'Calle 10 #500',
      phone: '5511223344',
      footerText: '¡Gracias por su visita!',
    },
    currency: {
      code: 'MXN',
      decimals: 2,
      symbol: '$',
    },
    pricesIncludeTax: false,
    requireShift: true,
    allowNegativeStock: true,
    maxDiscountBp: 1500, // 15%
    paymentMethods: [
      { id: 'cash', label: 'Efectivo', kind: 'cash', active: true, requireReference: false },
      { id: 'card', label: 'Tarjeta', kind: 'card', active: true, requireReference: true },
    ],
    modules: {},
    receipt: {
      paperWidthMm: 80,
      template: {},
    },
    mode: 'local',
  };

  beforeEach(async () => {
    db = createAppDatabase(`test_settings_${Date.now()}_${Math.random()}`);
    settingsRepo = new DexieSettingsRepository(db);
    await settingsRepo.save(initialSettings);
  });

  it('renders settings and updates business information and currency', async () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Ajustes del Sistema' })).toBeInTheDocument();

    // Check business tab fields
    const nameInput = screen.getByLabelText(/nombre comercial \/ razón social/i);
    fireEvent.change(nameInput, { target: { value: 'Super Don Pepe Sucursal 1' } });

    const symbolInput = screen.getByLabelText(/símbolo de moneda/i);
    fireEvent.change(symbolInput, { target: { value: 'MX$' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('¡Cambios guardados!')).toBeInTheDocument();
    });
  });

  it('switches to sales rules tab and modifies rules', async () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>,
    );

    // Switch to Reglas de Venta tab
    fireEvent.click(screen.getByRole('button', { name: /reglas de venta/i }));
    expect(screen.getByText(/descuento máximo permitido a cajeros/i)).toBeInTheDocument();

    const discountInput = screen.getByLabelText(/descuento máximo permitido a cajeros/i);
    fireEvent.change(discountInput, { target: { value: '20' } });

    // Save
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('¡Cambios guardados!')).toBeInTheDocument();
    });
  });

  it('switches to payment methods tab, toggles methods, and adds custom method', async () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>,
    );

    // Switch to Métodos de Pago
    fireEvent.click(screen.getByRole('button', { name: /métodos de pago/i }));
    expect(screen.getByDisplayValue('Efectivo')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/tarjeta/i)).toBeInTheDocument();

    // Click Agregar Método
    const addBtn = screen.getByRole('button', { name: /agregar método/i });
    fireEvent.click(addBtn);

    expect(screen.getByDisplayValue('Nuevo Método')).toBeInTheDocument();

    // Save
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('¡Cambios guardados!')).toBeInTheDocument();
    });
  });
});
