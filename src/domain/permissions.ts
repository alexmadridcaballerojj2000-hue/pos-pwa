import type { User, UserRole } from './types';

export type Permission =
  | 'sales:create'
  | 'sales:void'
  | 'sales:return'
  | 'discount:override'
  | 'cash:movement'
  | 'shift:manage'
  | 'inventory:adjust'
  | 'catalog:manage'
  | 'settings:manage'
  | 'users:manage'
  | 'reports:view';

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  owner: [
    'sales:create',
    'sales:void',
    'sales:return',
    'discount:override',
    'cash:movement',
    'shift:manage',
    'inventory:adjust',
    'catalog:manage',
    'settings:manage',
    'users:manage',
    'reports:view',
  ],
  manager: [
    'sales:create',
    'sales:void',
    'sales:return',
    'discount:override',
    'cash:movement',
    'shift:manage',
    'inventory:adjust',
    'catalog:manage',
    'settings:manage',
    'reports:view',
  ],
  cashier: ['sales:create', 'sales:return', 'shift:manage', 'cash:movement'],
};

/**
 * Pure authorization check for POS operations.
 * - Inactive users have ZERO permissions regardless of role.
 * - Active users are evaluated according to role-based access control matrix.
 */
export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user || !user.active) {
    return false;
  }

  const rolePerms = ROLE_PERMISSIONS[user.role];
  if (!rolePerms) {
    return false;
  }

  return rolePerms.includes(permission);
}
