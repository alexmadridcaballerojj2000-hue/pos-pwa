import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CartState } from '@/domain';
import { calculateSale, DEFAULT_CURRENCY } from '@/domain';
import { CartPanel } from './cart-panel';
import { QuantityDialog } from './quantity-dialog';
import { LineNoteDialog } from './line-note-dialog';

describe('Cart UI & Numpad Interaction (S4-T3)', () => {
  const sampleItems = [
    {
      lineId: 'line-1',
      productId: 'prod-1',
      sku: 'COCA-600',
      name: 'Coca Cola 600ml',
      qty: 2000, // 2 units
      unitPrice: 2000, // $20.00
      taxRateId: 'tax-1',
      taxRateBp: 1600, // 16%
    },
    {
      lineId: 'line-2',
      productId: 'prod-2',
      sku: 'MANZANA-KG',
      name: 'Manzana Gala',
      qty: 1500, // 1.5 kg
      unitPrice: 4000, // $40.00/kg
      taxRateId: 'tax-1',
      taxRateBp: 1600,
      note: 'Escoger maduras',
    },
  ];

  const initialCalculation = calculateSale(sampleItems, undefined, false);
  const sampleCart: CartState = {
    items: sampleItems,
    pricesIncludeTax: false,
    lines: initialCalculation.lines,
    totals: initialCalculation.totals,
  };

  describe('QuantityDialog', () => {
    it('renders initial quantity and allows numpad digit entry and confirmation in Milli', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <QuantityDialog
          isOpen={true}
          onClose={onClose}
          productName="Coca Cola 600ml"
          initialQtyMilli={2000}
          allowFractional={false}
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText(/Coca Cola 600ml/i)).toBeInTheDocument();
      expect(screen.getByTestId('qty-display')).toHaveTextContent('2');

      // Clear by clicking 'C'
      fireEvent.click(screen.getByRole('button', { name: 'C' }));
      expect(screen.getByTestId('qty-display')).toHaveTextContent('0');

      // Type '5'
      fireEvent.click(screen.getByRole('button', { name: '5' }));
      expect(screen.getByTestId('qty-display')).toHaveTextContent('5');

      // Confirm
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
      expect(onConfirm).toHaveBeenCalledWith(5000); // 5000 Milli
      expect(onClose).toHaveBeenCalled();
    });

    it('supports fractional numbers with decimal point when allowFractional is true', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <QuantityDialog
          isOpen={true}
          onClose={onClose}
          productName="Manzana Gala"
          initialQtyMilli={1000}
          allowFractional={true}
          unit="kg"
          onConfirm={onConfirm}
        />,
      );

      // Backspace
      fireEvent.click(screen.getByRole('button', { name: /Borrar dígito/i }));

      // Type 2 . 7 5
      fireEvent.click(screen.getByRole('button', { name: '2' }));
      fireEvent.click(screen.getByRole('button', { name: '.' }));
      fireEvent.click(screen.getByRole('button', { name: '7' }));
      fireEvent.click(screen.getByRole('button', { name: '5' }));

      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
      expect(onConfirm).toHaveBeenCalledWith(2750); // 2.750 kg = 2750 Milli
    });

    it('quick add buttons increment quantity correctly', () => {
      const onConfirm = vi.fn();

      render(
        <QuantityDialog
          isOpen={true}
          onClose={() => {}}
          productName="Pan Dulce"
          initialQtyMilli={1000}
          allowFractional={true}
          onConfirm={onConfirm}
        />,
      );

      // Click +2
      fireEvent.click(screen.getByRole('button', { name: '+2' }));
      expect(screen.getByTestId('qty-display')).toHaveTextContent('3');

      // Click +0.5
      fireEvent.click(screen.getByRole('button', { name: '+0.5' }));
      expect(screen.getByTestId('qty-display')).toHaveTextContent('3.5');

      fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
      expect(onConfirm).toHaveBeenCalledWith(3500);
    });
  });

  describe('LineNoteDialog', () => {
    it('allows entering and saving a line note', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <LineNoteDialog
          isOpen={true}
          onClose={onClose}
          productName="Hamburguesa Especial"
          initialNote="Sin cebolla"
          onSave={onSave}
        />,
      );

      const textarea = screen.getByLabelText(/instrucciones especiales/i);
      expect(textarea).toHaveValue('Sin cebolla');

      fireEvent.change(textarea, { target: { value: 'Sin cebolla y extra queso' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

      expect(onSave).toHaveBeenCalledWith('Sin cebolla y extra queso');
      expect(onClose).toHaveBeenCalled();
    });

    it('allows deleting an existing note', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <LineNoteDialog
          isOpen={true}
          onClose={onClose}
          productName="Hamburguesa Especial"
          initialNote="Sin cebolla"
          onSave={onSave}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Eliminar/i }));
      expect(onSave).toHaveBeenCalledWith(undefined);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('CartPanel', () => {
    it('renders cart line items, formatted prices and totals', () => {
      render(
        <CartPanel
          cart={sampleCart}
          currency={DEFAULT_CURRENCY}
          onUpdateQty={vi.fn()}
          onRemoveItem={vi.fn()}
          onSetLineNote={vi.fn()}
          onClearCart={vi.fn()}
        />,
      );

      expect(screen.getByText('Coca Cola 600ml')).toBeInTheDocument();
      expect(screen.getByText('Manzana Gala')).toBeInTheDocument();
      expect(screen.getByText('Escoger maduras')).toBeInTheDocument();

      // Line totals:
      // Line 1: 2 * $20.00 = $40.00 + 16% = $46.40 (4640 Minor)
      // Line 2: 1.5 * $40.00 = $60.00 + 16% = $69.60 (6960 Minor)
      // Total: 46.40 + 69.60 = $116.00 (11600 Minor)
      expect(screen.getByText(/46,40/)).toBeInTheDocument();
      expect(screen.getByText(/69,60/)).toBeInTheDocument();
      expect(screen.getByText(/116,00/)).toBeInTheDocument();
    });

    it('calls onUpdateQty when plus and minus buttons are clicked', () => {
      const onUpdateQty = vi.fn();

      render(
        <CartPanel
          cart={sampleCart}
          currency={DEFAULT_CURRENCY}
          onUpdateQty={onUpdateQty}
          onRemoveItem={vi.fn()}
          onSetLineNote={vi.fn()}
          onClearCart={vi.fn()}
        />,
      );

      const plusButtons = screen.getAllByRole('button', { name: /Aumentar cantidad/i });
      fireEvent.click(plusButtons[0]!);
      // line-1 had 2000 qty -> should be 3000
      expect(onUpdateQty).toHaveBeenCalledWith('line-1', 3000);

      const minusButtons = screen.getAllByRole('button', { name: /Disminuir cantidad/i });
      fireEvent.click(minusButtons[0]!);
      expect(onUpdateQty).toHaveBeenCalledWith('line-1', 1000);
    });

    it('opens QuantityDialog when quantity badge is clicked', () => {
      render(
        <CartPanel
          cart={sampleCart}
          currency={DEFAULT_CURRENCY}
          onUpdateQty={vi.fn()}
          onRemoveItem={vi.fn()}
          onSetLineNote={vi.fn()}
          onClearCart={vi.fn()}
        />,
      );

      const qtyButton = screen.getByRole('button', { name: /Editar cantidad 2/i });
      fireEvent.click(qtyButton);

      // Dialog should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Cant. — unit/i)).toBeInTheDocument();
    });

    it('calls onRemoveItem when delete icon on a line is clicked', () => {
      const onRemoveItem = vi.fn();

      render(
        <CartPanel
          cart={sampleCart}
          currency={DEFAULT_CURRENCY}
          onUpdateQty={vi.fn()}
          onRemoveItem={onRemoveItem}
          onSetLineNote={vi.fn()}
          onClearCart={vi.fn()}
        />,
      );

      const removeButtons = screen.getAllByRole('button', { name: /Eliminar producto/i });
      fireEvent.click(removeButtons[0]!);
      expect(onRemoveItem).toHaveBeenCalledWith('line-1');
    });

    it('calls onClearCart when delete cart button in header is clicked', () => {
      const onClearCart = vi.fn();

      render(
        <CartPanel
          cart={sampleCart}
          currency={DEFAULT_CURRENCY}
          onUpdateQty={vi.fn()}
          onRemoveItem={vi.fn()}
          onSetLineNote={vi.fn()}
          onClearCart={onClearCart}
        />,
      );

      const clearBtn = screen.getByRole('button', { name: /Vaciar carrito/i });
      fireEvent.click(clearBtn);
      expect(onClearCart).toHaveBeenCalledTimes(1);
    });
  });
});
