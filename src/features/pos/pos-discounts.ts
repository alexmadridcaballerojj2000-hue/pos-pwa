import type { Discount, Minor, User } from '@/domain';
import { can } from '@/domain';

export interface DiscountCheckResult {
  requiresApproval: boolean;
  effectiveBp: number;
}

/**
 * Checks whether applying a discount requires manager PIN authorization.
 *
 * Rules:
 * - If user has 'discount:override' permission (owner/manager), no approval is required.
 * - For percent discount, effectiveBp is discount.value.
 * - For fixed discount, effectiveBp is (discount.value * 10000) / baseAmount.
 * - If effectiveBp exceeds maxDiscountBp (default 1000 = 10%), approval is required.
 */
export function checkDiscountRequiresApproval(
  discount: Discount,
  baseAmount: Minor,
  maxDiscountBp: number,
  currentUser: User | null | undefined,
): DiscountCheckResult {
  if (baseAmount <= 0) {
    return { requiresApproval: false, effectiveBp: 0 };
  }

  const effectiveBp =
    discount.type === 'percent'
      ? discount.value
      : Math.round((discount.value * 10000) / baseAmount);

  // Owners and managers with 'discount:override' do not require approval
  if (can(currentUser, 'discount:override')) {
    return { requiresApproval: false, effectiveBp };
  }

  // Cashiers require manager approval when discount exceeds the max allowed limit
  const requiresApproval = effectiveBp > maxDiscountBp;
  return { requiresApproval, effectiveBp };
}
