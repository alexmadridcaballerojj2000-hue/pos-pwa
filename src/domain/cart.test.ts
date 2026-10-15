import { describe, it, expect } from 'vitest';
import { createEmptyCart, cartReducer } from './cart';
import { generateId } from './ids';

describe('Cart Reducer & Calculator (SPEC §5.2 & §6.2)', () => {
  const taxRate15Id = generateId();

  it('SPEC §6.2 Golden Case: Fractional quantity (price 2500 x 1.250 kg / qty 1250 -> lineBase 3125)', () => {
    let cart = createEmptyCart(true);

    const lineId = generateId();
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId,
        productId: generateId(),
        sku: 'MANZANA-KG',
        name: 'Manzana Granel',
        unitPrice: 2500, // 25.00
        qty: 1250, // 1.250 kg
        taxRateId: taxRate15Id,
        taxRateBp: 1500, // 15%
      },
    });

    expect(cart.lines.length).toBe(1);
    const line = cart.lines[0]!;
    expect(line.lineBase).toBe(3125); // mulDivRound(2500, 1250, 1000) = 3125
    expect(cart.totals.subtotal).toBe(3125);
  });

  it('accumulates quantity when adding the identical item twice without custom discount', () => {
    let cart = createEmptyCart(true);
    const productId = generateId();

    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: generateId(),
        productId,
        sku: 'CAFE-01',
        name: 'Café Espresso',
        unitPrice: 2000,
        qty: 1000, // 1 unit
        taxRateId: taxRate15Id,
        taxRateBp: 1500,
      },
    });

    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: generateId(),
        productId,
        sku: 'CAFE-01',
        name: 'Café Espresso',
        unitPrice: 2000,
        qty: 2000, // 2 units
        taxRateId: taxRate15Id,
        taxRateBp: 1500,
      },
    });

    expect(cart.items.length).toBe(1);
    expect(cart.items[0]?.qty).toBe(3000); // 3 units
    expect(cart.totals.subtotal).toBe(6000); // 3 * 2000
  });

  it('updates quantity and removes line when quantity is set to 0', () => {
    let cart = createEmptyCart(true);
    const lineId = generateId();

    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId,
        productId: generateId(),
        sku: 'JUICE-01',
        name: 'Jugo de Naranja',
        unitPrice: 1500,
        qty: 1000,
        taxRateId: taxRate15Id,
        taxRateBp: 1500,
      },
    });

    expect(cart.lines.length).toBe(1);

    // Update to 2 units
    cart = cartReducer(cart, {
      type: 'UPDATE_QTY',
      payload: { lineId, qty: 2000 },
    });
    expect(cart.totals.subtotal).toBe(3000);

    // Update to 0 units -> removes line
    cart = cartReducer(cart, {
      type: 'UPDATE_QTY',
      payload: { lineId, qty: 0 },
    });
    expect(cart.lines.length).toBe(0);
    expect(cart.totals.total).toBe(0);
  });

  it('removes item using REMOVE_ITEM', () => {
    let cart = createEmptyCart(true);
    const lineId = generateId();

    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId,
        productId: generateId(),
        sku: 'SNACK-01',
        name: 'Snack',
        unitPrice: 1000,
        qty: 1000,
        taxRateId: taxRate15Id,
        taxRateBp: 1500,
      },
    });

    expect(cart.lines.length).toBe(1);

    cart = cartReducer(cart, {
      type: 'REMOVE_ITEM',
      payload: { lineId },
    });

    expect(cart.lines.length).toBe(0);
    expect(cart.totals.total).toBe(0);
  });

  it('applies line discounts and global order discounts together with proration', () => {
    let cart = createEmptyCart(true);
    const line1Id = generateId();
    const line2Id = generateId();

    // Line 1: 10000 base with 10% line discount -> afterLine = 9000
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: line1Id,
        productId: generateId(),
        sku: 'ITEM-1',
        name: 'Item 1',
        unitPrice: 10000,
        qty: 1000,
        taxRateId: taxRate15Id,
        taxRateBp: 1500,
        discount: { type: 'percent', value: 1000 }, // 10%
      },
    });

    // Line 2: 10000 base with no line discount -> afterLine = 10000
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: line2Id,
        productId: generateId(),
        sku: 'ITEM-2',
        name: 'Item 2',
        unitPrice: 10000,
        qty: 1000,
        taxRateId: taxRate15Id,
        taxRateBp: 1500,
      },
    });

    // Sum after line discounts = 9000 + 10000 = 19000
    // Apply order discount of fixed 1900 (10% of total)
    cart = cartReducer(cart, {
      type: 'SET_ORDER_DISCOUNT',
      payload: { type: 'fixed', value: 1900 },
    });

    expect(cart.totals.subtotal).toBe(20000);
    expect(cart.totals.lineDiscounts).toBe(1000);
    expect(cart.totals.orderDiscount).toBe(1900);

    // Proration of 1900 across [9000, 10000]:
    // 1900 * 9000 / 19000 = 900
    // 1900 * 10000 / 19000 = 1000
    const l1 = cart.lines.find((l) => l.lineId === line1Id)!;
    const l2 = cart.lines.find((l) => l.lineId === line2Id)!;

    expect(l1.orderDiscountShare).toBe(900);
    expect(l2.orderDiscountShare).toBe(1000);
    expect(l1.taxableBase).toBe(8100); // 9000 - 900
    expect(l2.taxableBase).toBe(9000); // 10000 - 1000
    expect(cart.totals.total).toBe(17100); // 8100 + 9000
  });

  it('clears cart with CLEAR_CART', () => {
    let cart = createEmptyCart(true);
    cart = cartReducer(cart, {
      type: 'ADD_ITEM',
      payload: {
        lineId: generateId(),
        productId: generateId(),
        sku: 'ITEM',
        name: 'Item',
        unitPrice: 1000,
        qty: 1000,
        taxRateId: taxRate15Id,
        taxRateBp: 0,
      },
    });
    expect(cart.lines.length).toBe(1);

    cart = cartReducer(cart, { type: 'CLEAR_CART' });
    expect(cart.lines.length).toBe(0);
    expect(cart.totals.total).toBe(0);
  });
});
