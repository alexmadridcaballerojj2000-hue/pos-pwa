import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase } from '@/data/db';
import { completeSetup, type SetupFormData } from './setup-service';
import { WizardView } from './wizard-view';
import { verifyPin } from '@/domain';
import { getMeta, META_KEYS } from '@/data/meta';

describe('Setup Wizard (S2-T5)', () => {
  it('completeSetup service writes settings, taxRate, owner with PBKDF2 hash, meta and audit log', async () => {
    const db = createAppDatabase(`test_wizard_${Date.now()}`);

    const data: SetupFormData = {
      businessName: 'Abarrotes Don Pepe',
      taxId: 'PEP123456789',
      address: 'Calle Mayor 45',
      phone: '555-1234',
      receiptFooter: 'Vuelva pronto',
      currencyCode: 'MXN',
      currencySymbol: '$',
      decimals: 2,
      pricesIncludeTax: true,
      taxName: 'IVA General',
      taxPercent: 16,
      ownerName: 'Pepe Perez',
      ownerPin: '1234',
    };

    const result = await completeSetup(data, db);
    expect(result.deviceId).toBeDefined();
    expect(result.ownerId).toBeDefined();

    // Check Settings
    const settings = await db.settings.get('singleton');
    expect(settings?.business.name).toBe('Abarrotes Don Pepe');
    expect(settings?.currency.code).toBe('MXN');
    expect(settings?.pricesIncludeTax).toBe(true);
    expect(settings?.mode).toBe('local');

    // Check TaxRate
    const taxRate = await db.taxRates.get(result.taxRateId);
    expect(taxRate?.name).toBe('IVA General');
    expect(taxRate?.rateBp).toBe(1600);

    // Check Owner User
    const owner = await db.users.get(result.ownerId);
    expect(owner?.name).toBe('Pepe Perez');
    expect(owner?.role).toBe('owner');
    expect(owner?.active).toBe(true);

    // Verify PIN was properly hashed with WebCrypto PBKDF2
    const pinMatches = await verifyPin('1234', owner!.pin);
    expect(pinMatches).toBe(true);

    const wrongPinMatches = await verifyPin('9999', owner!.pin);
    expect(wrongPinMatches).toBe(false);

    // Check Meta flag
    const isSetupDone = await getMeta<boolean>(db, META_KEYS.SETUP_COMPLETED);
    expect(isSetupDone).toBe(true);

    // Check AuditLog
    const auditEntries = await db.auditLog.toArray();
    expect(auditEntries.some((a) => a.action === 'setup:complete')).toBe(true);
  });

  it('renders wizard steps and advances after filling required fields', async () => {
    render(<WizardView />);

    // Step 1: Business name is displayed
    expect(screen.getByText('Configuración Inicial')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /siguiente/i });

    // Trying to click next without business name shows validation error
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('El nombre del negocio es requerido')).toBeInTheDocument();
    });

    // Fill business name
    const businessNameInput = screen.getByPlaceholderText(/supermercado/i);
    fireEvent.change(businessNameInput, { target: { value: 'Mi Tienda' } });

    // Advance to step 2
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('Código de Moneda')).toBeInTheDocument();
    });
  });
});
