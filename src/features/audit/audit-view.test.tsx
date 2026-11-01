import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { useAuthStore } from '@/features/auth/auth-store';
import { AuditView } from './audit-view';
import { type AuditEntry, type User, type UUID, v7 } from '@/domain';

describe('AuditView (SPEC §6.8 & S7-T6)', () => {
  let db: AppDatabase;

  const ownerId: UUID = '018f0000-0000-7000-8000-000000000001' as UUID;
  const managerId: UUID = '018f0000-0000-7000-8000-000000000002' as UUID;
  const cashierId: UUID = '018f0000-0000-7000-8000-000000000003' as UUID;

  const mockOwner: User = {
    id: ownerId,
    name: 'Don Pepe Dueño',
    role: 'owner',
    active: true,
    pin: { hash: 'h', salt: 's', iterations: 210000 },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const mockManager: User = {
    id: managerId,
    name: 'Marta Gerente',
    role: 'manager',
    active: true,
    pin: { hash: 'h', salt: 's', iterations: 210000 },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const mockCashier: User = {
    id: cashierId,
    name: 'Carlos Cajero',
    role: 'cashier',
    active: true,
    pin: { hash: 'h', salt: 's', iterations: 210000 },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const sampleEntries: AuditEntry[] = [
    {
      id: v7(),
      ts: '2026-11-01T08:00:00.000Z',
      userId: cashierId,
      action: 'shift:opened',
      entity: 'shift',
      entityId: v7(),
      details: { openingFloat: 50000 },
    },
    {
      id: v7(),
      ts: '2026-11-01T09:30:00.000Z',
      userId: cashierId,
      action: 'sale:create',
      entity: 'sale',
      entityId: v7(),
      details: { total: 12500, number: 'L01-000001' },
    },
    {
      id: v7(),
      ts: '2026-11-01T10:15:00.000Z',
      userId: managerId,
      action: 'discount:approved',
      entity: 'discount',
      details: { percent: 15, approvedFor: cashierId },
    },
    {
      id: v7(),
      ts: '2026-11-01T11:00:00.000Z',
      userId: cashierId,
      action: 'cash_movement:in',
      entity: 'cashMovement',
      details: { amount: 10000, reason: 'Aportación de cambio' },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    db = createAppDatabase(`audit_view_test_${Date.now()}_${Math.random()}`);

    await db.users.bulkAdd([mockOwner, mockManager, mockCashier]);
    await db.auditLog.bulkAdd(sampleEntries);

    useAuthStore.setState({
      currentUser: mockOwner,
      isAuthenticated: true,
    });
  });

  it('denies access to cashiers with restricted notice', async () => {
    useAuthStore.setState({ currentUser: mockCashier });

    render(<AuditView db={db} currentUser={mockCashier} />);

    await waitFor(() => {
      expect(screen.getByText('Acceso Restringido')).toBeInTheDocument();
      expect(screen.queryByText('Registro de Auditoría')).not.toBeInTheDocument();
    });
  });

  it('grants access to managers and displays all audit entries', async () => {
    useAuthStore.setState({ currentUser: mockManager });

    render(<AuditView db={db} currentUser={mockManager} />);

    await waitFor(() => {
      expect(screen.getByText('Registro de Auditoría')).toBeInTheDocument();
      expect(screen.getByText('shift:opened')).toBeInTheDocument();
      expect(screen.getByText('sale:create')).toBeInTheDocument();
      expect(screen.getByText('discount:approved')).toBeInTheDocument();
      expect(screen.getByText('cash_movement:in')).toBeInTheDocument();
    });
  });

  it('filters entries by action query', async () => {
    const user = userEvent.setup();
    render(<AuditView db={db} currentUser={mockOwner} />);

    await waitFor(() => {
      expect(screen.getByText('shift:opened')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Ej\. shift, sale, cash\.\.\./i);
    await user.type(searchInput, 'discount');

    await waitFor(() => {
      expect(screen.getByText('discount:approved')).toBeInTheDocument();
      expect(screen.queryByText('shift:opened')).not.toBeInTheDocument();
      expect(screen.queryByText('sale:create')).not.toBeInTheDocument();
    });
  });

  it('filters entries by user dropdown', async () => {
    const user = userEvent.setup();
    render(<AuditView db={db} currentUser={mockOwner} />);

    await waitFor(() => {
      expect(screen.getByText('discount:approved')).toBeInTheDocument();
    });

    const userSelect = screen.getByLabelText(/Usuario/i);
    await user.selectOptions(userSelect, managerId);

    await waitFor(() => {
      expect(screen.getByText('discount:approved')).toBeInTheDocument();
      expect(screen.queryByText('sale:create')).not.toBeInTheDocument();
      expect(screen.queryByText('shift:opened')).not.toBeInTheDocument();
    });
  });

  it('expands row to inspect JSON details', async () => {
    const user = userEvent.setup();
    render(<AuditView db={db} currentUser={mockOwner} />);

    await waitFor(() => {
      expect(screen.getByText('shift:opened')).toBeInTheDocument();
    });

    // Click on the shift:opened row
    const shiftRow = screen.getByText('shift:opened').closest('tr')!;
    await user.click(shiftRow);

    await waitFor(() => {
      expect(screen.getByText(/Metadatos del Evento/i)).toBeInTheDocument();
      expect(screen.getByText(/openingFloat/i)).toBeInTheDocument();
    });
  });

  it('triggers CSV download when clicking Exportar CSV', async () => {
    const user = userEvent.setup();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:test');
    const revokeObjectUrlMock = vi.fn();
    window.URL.createObjectURL = createObjectUrlMock;
    window.URL.revokeObjectURL = revokeObjectUrlMock;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<AuditView db={db} currentUser={mockOwner} />);

    await waitFor(() => {
      expect(screen.getByText('Registro de Auditoría')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Exportar CSV/i });
    await user.click(exportBtn);

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});
