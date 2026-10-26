import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase, type AppDatabase } from '@/data/db';
import type { User, Discount } from '@/domain';
import { DEFAULT_CURRENCY, hashPin } from '@/domain';
import { checkDiscountRequiresApproval } from './pos-discounts';
import { DiscountDialog } from './discount-dialog';

describe('POS Discounts & Authorization Guard (S4-T4)', () => {
  let db: AppDatabase;
  let cashierUser: User;
  let managerUser: User;

  beforeEach(async () => {
    db = createAppDatabase(`test_discounts_${Date.now()}_${Math.random()}`);

    const managerPin = await hashPin('1234');
    managerUser = {
      id: '018f0000-0000-7000-8000-000000000099',
      name: 'Gerente Carlos',
      role: 'manager',
      active: true,
      pin: managerPin,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    const cashierPin = await hashPin('0000');
    cashierUser = {
      id: '018f0000-0000-7000-8000-000000000088',
      name: 'Cajero Juan',
      role: 'cashier',
      active: true,
      pin: cashierPin,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await db.users.bulkAdd([managerUser, cashierUser]);
  });

  describe('pos-discounts permission check logic', () => {
    it('allows managers and owners to apply any discount without approval', () => {
      const discount: Discount = { type: 'percent', value: 2500 }; // 25%
      const res = checkDiscountRequiresApproval(discount, 10000, 1000, managerUser);
      expect(res.requiresApproval).toBe(false);
      expect(res.effectiveBp).toBe(2500);
    });

    it('allows cashiers to apply discounts within maxDiscountBp without approval', () => {
      const discount: Discount = { type: 'percent', value: 1000 }; // 10%
      const res = checkDiscountRequiresApproval(discount, 10000, 1000, cashierUser);
      expect(res.requiresApproval).toBe(false);
      expect(res.effectiveBp).toBe(1000);
    });

    it('requires manager approval when cashier discount exceeds maxDiscountBp', () => {
      const discount: Discount = { type: 'percent', value: 1500 }; // 15% > 10%
      const res = checkDiscountRequiresApproval(discount, 10000, 1000, cashierUser);
      expect(res.requiresApproval).toBe(true);
      expect(res.effectiveBp).toBe(1500);
    });

    it('calculates effectiveBp for fixed amount discounts and requires approval if exceeding limit', () => {
      // Base: $100.00 (10000 minor). Fixed discount: $15.00 (1500 minor) = 15%
      const discount: Discount = { type: 'fixed', value: 1500 };
      const res = checkDiscountRequiresApproval(discount, 10000, 1000, cashierUser);
      expect(res.requiresApproval).toBe(true);
      expect(res.effectiveBp).toBe(1500);

      // Fixed discount: $5.00 (500 minor) on $100.00 = 5% <= 10%
      const smallDiscount: Discount = { type: 'fixed', value: 500 };
      const resSmall = checkDiscountRequiresApproval(smallDiscount, 10000, 1000, cashierUser);
      expect(resSmall.requiresApproval).toBe(false);
      expect(resSmall.effectiveBp).toBe(500);
    });
  });

  describe('DiscountDialog UI & Approval Flow', () => {
    it('applies discount directly when cashier enters discount <= max limit', () => {
      const onApply = vi.fn();
      const onClose = vi.fn();

      render(
        <DiscountDialog
          isOpen={true}
          onClose={onClose}
          title="Descuento de Línea"
          baseAmount={10000} // $100.00
          currency={DEFAULT_CURRENCY}
          maxDiscountBp={1000} // 10%
          currentUser={cashierUser}
          onApplyDiscount={onApply}
          db={db}
        />,
      );

      // Default is 10% -> 10% <= 10%
      const saveBtn = screen.getByRole('button', { name: /Guardar/i });
      fireEvent.click(saveBtn);

      expect(onApply).toHaveBeenCalledWith({
        type: 'percent',
        value: 1000,
        reason: undefined,
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('prompts for manager approval when cashier discount > limit, and applies with managerId upon valid PIN', async () => {
      const onApply = vi.fn();
      const onClose = vi.fn();

      render(
        <DiscountDialog
          isOpen={true}
          onClose={onClose}
          title="Descuento General"
          baseAmount={10000} // $100.00
          currency={DEFAULT_CURRENCY}
          maxDiscountBp={1000} // 10%
          currentUser={cashierUser}
          onApplyDiscount={onApply}
          db={db}
        />,
      );

      // Click quick chip 20%
      const chip20 = screen.getByRole('button', { name: '20%' });
      fireEvent.click(chip20);

      // Fill reason
      const reasonInput = screen.getByPlaceholderText(/Ej. Promoción, Cortesía/i);
      fireEvent.change(reasonInput, { target: { value: 'Cliente frecuente' } });

      // Click save
      const saveBtn = screen.getByRole('button', { name: /Guardar/i });
      fireEvent.click(saveBtn);

      // ManagerApprovalDialog should now be open
      expect(await screen.findByText('Aprobación de Gerente')).toBeInTheDocument();

      // Enter valid manager PIN '1234' on pin-pad
      const pinButtons = screen.getAllByRole('button');
      const getPinBtn = (num: string) => pinButtons.find((b) => b.textContent === num)!;

      fireEvent.click(getPinBtn('1'));
      fireEvent.click(getPinBtn('2'));
      fireEvent.click(getPinBtn('3'));
      fireEvent.click(getPinBtn('4'));

      // Click Autorizar
      const authorizeBtn = screen.getByRole('button', { name: /Autorizar/i });
      fireEvent.click(authorizeBtn);

      await waitFor(() => {
        expect(onApply).toHaveBeenCalledWith({
          type: 'percent',
          value: 2000,
          reason: 'Cliente frecuente',
          approvedBy: managerUser.id,
        });
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('rejects authorization when invalid PIN is entered', async () => {
      const onApply = vi.fn();

      render(
        <DiscountDialog
          isOpen={true}
          onClose={() => {}}
          title="Descuento de Línea"
          baseAmount={10000}
          currency={DEFAULT_CURRENCY}
          maxDiscountBp={1000}
          currentUser={cashierUser}
          onApplyDiscount={onApply}
          db={db}
        />,
      );

      // Select 20%
      fireEvent.click(screen.getByRole('button', { name: '20%' }));
      fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

      // Enter wrong PIN '9999'
      const pinButtons = screen.getAllByRole('button');
      const getPinBtn = (num: string) => pinButtons.find((b) => b.textContent === num)!;

      fireEvent.click(getPinBtn('9'));
      fireEvent.click(getPinBtn('9'));
      fireEvent.click(getPinBtn('9'));
      fireEvent.click(getPinBtn('9'));

      fireEvent.click(screen.getByRole('button', { name: /Autorizar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/El PIN ingresado no pertenece a un gerente o dueño activo/i),
        ).toBeInTheDocument();
      });

      expect(onApply).not.toHaveBeenCalled();
    });

    it('allows manager to apply 25% discount directly without prompt', () => {
      const onApply = vi.fn();
      const onClose = vi.fn();

      render(
        <DiscountDialog
          isOpen={true}
          onClose={onClose}
          title="Descuento de Línea"
          baseAmount={10000}
          currency={DEFAULT_CURRENCY}
          maxDiscountBp={1000}
          currentUser={managerUser} // Manager
          onApplyDiscount={onApply}
          db={db}
        />,
      );

      const percentInput = screen.getByLabelText(/Porcentaje de Descuento/i);
      fireEvent.change(percentInput, { target: { value: '25' } });

      fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

      // Immediately applied
      expect(onApply).toHaveBeenCalledWith({
        type: 'percent',
        value: 2500,
        reason: undefined,
      });
      expect(onClose).toHaveBeenCalled();
      expect(screen.queryByText('Aprobación de Gerente')).not.toBeInTheDocument();
    });

    it('allows removing an existing discount', () => {
      const onRemove = vi.fn();
      const onClose = vi.fn();

      render(
        <DiscountDialog
          isOpen={true}
          onClose={onClose}
          title="Descuento de Línea"
          baseAmount={10000}
          initialDiscount={{ type: 'percent', value: 1000 }}
          currency={DEFAULT_CURRENCY}
          currentUser={cashierUser}
          onApplyDiscount={() => {}}
          onRemoveDiscount={onRemove}
          db={db}
        />,
      );

      const removeBtn = screen.getByRole('button', { name: /Quitar/i });
      fireEvent.click(removeBtn);

      expect(onRemove).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
