import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import { hashPin, type User } from '@/domain';
import { useAuthStore } from './auth-store';
import { ManagerApprovalDialog } from './manager-approval-dialog';
import { LoginView } from './login-view';

describe('Auth & PIN Security (S2-T6)', () => {
  let db: AppDatabase;
  let cashierUser: User;
  let managerUser: User;

  beforeEach(async () => {
    db = createAppDatabase(`test_auth_${Date.now()}_${Math.random()}`);
    useAuthStore.getState().resetLockout();
    useAuthStore.getState().setCurrentUser(null);

    const cashierPin = await hashPin('1111', 1000);
    const managerPin = await hashPin('2222', 1000);

    cashierUser = {
      id: '018f0000-0000-7000-8000-000000000010',
      name: 'Carlos Cajero',
      role: 'cashier',
      active: true,
      pin: cashierPin,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    managerUser = {
      id: '018f0000-0000-7000-8000-000000000020',
      name: 'Maria Gerente',
      role: 'manager',
      active: true,
      pin: managerPin,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await db.users.add(cashierUser);
    await db.users.add(managerUser);
  });

  describe('useAuthStore', () => {
    it('authenticates user with correct PIN and logs audit event', async () => {
      const res = await useAuthStore.getState().login(cashierUser.id, '1111', db);
      expect(res.success).toBe(true);

      const currentUser = useAuthStore.getState().currentUser;
      expect(currentUser?.id).toBe(cashierUser.id);
      expect(useAuthStore.getState().failedAttempts).toBe(0);

      // Verify audit log
      const audit = await db.auditLog.where('action').equals('auth:login').first();
      expect(audit?.userId).toBe(cashierUser.id);
    });

    it('locks out user after 5 consecutive failed attempts', async () => {
      // 4 wrong attempts
      for (let i = 0; i < 4; i++) {
        const res = await useAuthStore.getState().login(cashierUser.id, '9999', db);
        expect(res.success).toBe(false);
        expect(res.error).toBe('invalid_pin');
      }

      expect(useAuthStore.getState().failedAttempts).toBe(4);
      expect(useAuthStore.getState().lockedUntil).toBeNull();

      // 5th wrong attempt triggers lockout
      const fifthRes = await useAuthStore.getState().login(cashierUser.id, '9999', db);
      expect(fifthRes.success).toBe(false);
      expect(fifthRes.error).toBe('locked');
      expect(fifthRes.remainingLockSeconds).toBeGreaterThan(0);

      const state = useAuthStore.getState();
      expect(state.lockedUntil).not.toBeNull();

      // Subsequent attempt is blocked by lockout
      const blockedRes = await useAuthStore.getState().login(cashierUser.id, '1111', db);
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.error).toBe('locked');

      // Verify lockout audit log
      const lockoutAudit = await db.auditLog.where('action').equals('auth:lockout').first();
      expect(lockoutAudit?.userId).toBe(cashierUser.id);
    });

    it('auto-locks session on inactivity', async () => {
      useAuthStore.getState().setCurrentUser(cashierUser);
      // Simulate last activity 20 minutes ago
      useAuthStore.setState({ lastActivityAt: Date.now() - 20 * 60 * 1000 });

      const autoLocked = await useAuthStore.getState().checkInactivity(db);
      expect(autoLocked).toBe(true);
      expect(useAuthStore.getState().currentUser).toBeNull();

      const audit = await db.auditLog.where('action').equals('auth:auto_lock').first();
      expect(audit?.userId).toBe(cashierUser.id);
    });

    it('logs out and logs audit event', async () => {
      useAuthStore.getState().setCurrentUser(cashierUser);
      await useAuthStore.getState().logout(db);

      expect(useAuthStore.getState().currentUser).toBeNull();
      const audit = await db.auditLog.where('action').equals('auth:logout').first();
      expect(audit?.userId).toBe(cashierUser.id);
    });
  });

  describe('ManagerApprovalDialog', () => {
    it('approves sensitive action when manager enters valid PIN', async () => {
      let approvedManagerId: string | null = null;
      let isClosed = false;

      render(
        <ManagerApprovalDialog
          isOpen={true}
          onClose={() => {
            isClosed = true;
          }}
          onApprove={(id) => {
            approvedManagerId = id;
          }}
          requiredPermission="sales:void"
          reason="Cliente solicitó cancelación"
          db={db}
        />,
      );

      expect(screen.getByText('Aprobación de Gerente')).toBeInTheDocument();
      expect(screen.getByText(/cliente solicitó cancelación/i)).toBeInTheDocument();

      // Enter manager PIN (2222)
      const btn2 = screen.getByRole('button', { name: '2' });
      fireEvent.click(btn2);
      fireEvent.click(btn2);
      fireEvent.click(btn2);
      fireEvent.click(btn2);

      const authorizeBtn = screen.getByRole('button', { name: /autorizar/i });
      fireEvent.click(authorizeBtn);

      await waitFor(() => {
        expect(approvedManagerId).toBe(managerUser.id);
        expect(isClosed).toBe(true);
      });

      // Audit log has approval
      const approvalAudit = await db.auditLog.where('action').equals('manager:approval').first();
      expect(approvalAudit?.userId).toBe(managerUser.id);
    });

    it('rejects approval when a cashier PIN is entered', async () => {
      let approvedManagerId: string | null = null;

      render(
        <ManagerApprovalDialog
          isOpen={true}
          onClose={() => {}}
          onApprove={(id) => {
            approvedManagerId = id;
          }}
          requiredPermission="sales:void"
          db={db}
        />,
      );

      // Enter cashier PIN (1111)
      const btn1 = screen.getByRole('button', { name: '1' });
      fireEvent.click(btn1);
      fireEvent.click(btn1);
      fireEvent.click(btn1);
      fireEvent.click(btn1);

      const authorizeBtn = screen.getByRole('button', { name: /autorizar/i });
      fireEvent.click(authorizeBtn);

      await waitFor(() => {
        expect(screen.getByText(/no pertenece a un gerente o dueño activo/i)).toBeInTheDocument();
        expect(approvedManagerId).toBeNull();
      });
    });
  });

  describe('LoginView Component', () => {
    it('renders user selection and allows entering PIN', async () => {
      let loggedIn = false;

      render(
        <LoginView
          onLoginSuccess={() => {
            loggedIn = true;
          }}
          db={db}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Carlos Cajero')).toBeInTheDocument();
        expect(screen.getByText('Maria Gerente')).toBeInTheDocument();
      });

      // Click on Carlos Cajero
      fireEvent.click(screen.getByText('Carlos Cajero'));

      // Enter PIN 1111
      const btn1 = screen.getByRole('button', { name: '1' });
      fireEvent.click(btn1);
      fireEvent.click(btn1);
      fireEvent.click(btn1);
      fireEvent.click(btn1);

      const loginBtn = screen.getByRole('button', { name: /ingresar/i });
      fireEvent.click(loginBtn);

      await waitFor(() => {
        expect(loggedIn).toBe(true);
      });
    });
  });
});
