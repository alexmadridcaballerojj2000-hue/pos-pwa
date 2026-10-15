import type { UUID, Milli } from './index';
import type { Discount } from './discount';
import { calculateSale, type CartItemInput, type SaleLine, type SaleTotals } from './calculator';

export interface CartState {
  items: CartItemInput[];
  orderDiscount?: Discount;
  pricesIncludeTax: boolean;
  customerId?: UUID | null;
  notes?: string;
  lines: SaleLine[];
  totals: SaleTotals;
}

export type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItemInput }
  | { type: 'UPDATE_QTY'; payload: { lineId: UUID; qty: Milli } }
  | { type: 'REMOVE_ITEM'; payload: { lineId: UUID } }
  | { type: 'SET_LINE_DISCOUNT'; payload: { lineId: UUID; discount?: Discount } }
  | { type: 'SET_LINE_NOTE'; payload: { lineId: UUID; note?: string } }
  | { type: 'SET_ORDER_DISCOUNT'; payload?: Discount }
  | { type: 'SET_CUSTOMER'; payload?: UUID | null }
  | { type: 'SET_NOTES'; payload?: string }
  | { type: 'SET_PRICES_INCLUDE_TAX'; payload: boolean }
  | { type: 'CLEAR_CART' };

/**
 * Creates an empty initial CartState.
 */
export function createEmptyCart(pricesIncludeTax = true): CartState {
  const calculation = calculateSale([], undefined, pricesIncludeTax);
  return {
    items: [],
    orderDiscount: undefined,
    pricesIncludeTax,
    customerId: null,
    notes: undefined,
    lines: calculation.lines,
    totals: calculation.totals,
  };
}

/**
 * Pure state reducer for Cart.
 * Recomputes lines and totals immutably on every action.
 */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const newItem = action.payload;
      // If line with same productId, unitPrice, taxRateId and NO custom discount/note exists, accumulate qty
      const existingIndex = state.items.findIndex(
        (item) =>
          item.productId === newItem.productId &&
          item.unitPrice === newItem.unitPrice &&
          item.taxRateId === newItem.taxRateId &&
          !item.discount &&
          !newItem.discount &&
          !item.note &&
          !newItem.note,
      );

      let nextItems: CartItemInput[];
      if (existingIndex >= 0) {
        nextItems = state.items.map((item, idx) =>
          idx === existingIndex ? { ...item, qty: item.qty + newItem.qty } : item,
        );
      } else {
        nextItems = [...state.items, newItem];
      }

      const { lines, totals } = calculateSale(
        nextItems,
        state.orderDiscount,
        state.pricesIncludeTax,
      );

      return {
        ...state,
        items: nextItems,
        lines,
        totals,
      };
    }

    case 'UPDATE_QTY': {
      const { lineId, qty } = action.payload;
      let nextItems: CartItemInput[];

      if (qty <= 0) {
        nextItems = state.items.filter((item) => item.lineId !== lineId);
      } else {
        nextItems = state.items.map((item) => (item.lineId === lineId ? { ...item, qty } : item));
      }

      const { lines, totals } = calculateSale(
        nextItems,
        state.orderDiscount,
        state.pricesIncludeTax,
      );

      return {
        ...state,
        items: nextItems,
        lines,
        totals,
      };
    }

    case 'REMOVE_ITEM': {
      const nextItems = state.items.filter((item) => item.lineId !== action.payload.lineId);
      const { lines, totals } = calculateSale(
        nextItems,
        state.orderDiscount,
        state.pricesIncludeTax,
      );

      return {
        ...state,
        items: nextItems,
        lines,
        totals,
      };
    }

    case 'SET_LINE_DISCOUNT': {
      const { lineId, discount } = action.payload;
      const nextItems = state.items.map((item) =>
        item.lineId === lineId ? { ...item, discount } : item,
      );

      const { lines, totals } = calculateSale(
        nextItems,
        state.orderDiscount,
        state.pricesIncludeTax,
      );

      return {
        ...state,
        items: nextItems,
        lines,
        totals,
      };
    }

    case 'SET_LINE_NOTE': {
      const { lineId, note } = action.payload;
      const nextItems = state.items.map((item) =>
        item.lineId === lineId ? { ...item, note } : item,
      );

      const { lines, totals } = calculateSale(
        nextItems,
        state.orderDiscount,
        state.pricesIncludeTax,
      );

      return {
        ...state,
        items: nextItems,
        lines,
        totals,
      };
    }

    case 'SET_ORDER_DISCOUNT': {
      const orderDiscount = action.payload;
      const { lines, totals } = calculateSale(state.items, orderDiscount, state.pricesIncludeTax);

      return {
        ...state,
        orderDiscount,
        lines,
        totals,
      };
    }

    case 'SET_CUSTOMER': {
      return {
        ...state,
        customerId: action.payload,
      };
    }

    case 'SET_NOTES': {
      return {
        ...state,
        notes: action.payload,
      };
    }

    case 'SET_PRICES_INCLUDE_TAX': {
      const pricesIncludeTax = action.payload;
      const { lines, totals } = calculateSale(state.items, state.orderDiscount, pricesIncludeTax);

      return {
        ...state,
        pricesIncludeTax,
        lines,
        totals,
      };
    }

    case 'CLEAR_CART': {
      return createEmptyCart(state.pricesIncludeTax);
    }

    default:
      return state;
  }
}
